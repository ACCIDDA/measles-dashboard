# NC producer variant (#20): NC has no local stanfit, but Hopkins shipped the
# *already-predicted* estimates + a geojson of school points and county polygons.
# This adapter reshapes those into the SAME #20 CSV schema build_state.R emits
# for CA, so the dashboard loader treats both states identically.
#
# Inputs (under scripts/build-data/inputs/nc/):
#   estimates.csv      long: id, est, ci_low, ci_high, population, age_group, is_est
#                      (id = school, age_group 5_6..10_11 = grades K..5, est in 0..1)
#   locations.geojson  FeatureCollection in EPSG:2264 (NC State Plane, US ft):
#                      ~1825 Point features (schools)  -> NAME, location_id, coverage, cov_low/high
#                      ~100  Polygon features (counties)-> NAME, coverage, cov_low/high, herd_immune_fraction
#
# Decisions (per project owner):
#   - school -> county via point-in-polygon in native EPSG:2264 (no reprojection needed)
#   - county coverage taken directly from the geojson county polygons (not aggregated up)
suppressMessages({library(data.table); library(jsonlite)})

IN  <- Sys.getenv("NC_IN",  unset = "scripts/build-data/inputs/nc")
OUT <- Sys.getenv("OUT_DIR", unset = "scripts/build-data/out")
GRADE_AGES <- c("5_6","6_7","7_8","8_9","9_10","10_11")
GRADE_LAB  <- c("K","1","2","3","4","5")
names(GRADE_LAB) <- GRADE_AGES
THRESHOLD <- 0.95
slugify <- function(x) gsub("[^a-z0-9]+","-", tolower(trimws(x)))
covtier <- function(v) ifelse(is.na(v),NA_character_, ifelse(v>=0.95,"H",ifelse(v>=0.90,"M","L")))
# null-safe property accessor: geojson props may be JSON null -> R NULL, which
# would silently drop a data.table column. Coerce missing to NA.
nz <- function(v) if (is.null(v) || length(v) == 0) NA else v

# ---- ray-casting point-in-polygon (works in the native planar CRS) ----
# poly: list of rings, each an Nx2 matrix of [x,y]; point: c(x,y). Outer ring only.
point_in_ring <- function(x, y, ring) {
  n <- nrow(ring); inside <- FALSE; j <- n
  for (i in seq_len(n)) {
    xi <- ring[i,1]; yi <- ring[i,2]; xj <- ring[j,1]; yj <- ring[j,2]
    if (((yi > y) != (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside <- !inside
    j <- i
  }
  inside
}

# ---- load + split geojson ----
g <- fromJSON(file.path(IN, "locations.geojson"), simplifyVector = FALSE)
feats <- g$features
is_poly  <- vapply(feats, function(f) f$geometry$type == "Polygon", logical(1))
schools_geo <- feats[!is_poly]
county_geo  <- feats[is_poly]
message(sprintf("geojson: %d school points, %d county polygons", length(schools_geo), length(county_geo)))

# county polygons -> bbox + outer ring (for PIP) and the coverage props
counties <- lapply(county_geo, function(f) {
  ring <- do.call(rbind, lapply(f$geometry$coordinates[[1]], function(p) c(p[[1]], p[[2]])))
  list(name = f$properties$NAME, ring = ring,
       xr = range(ring[,1]), yr = range(ring[,2]),
       coverage = nz(f$properties$coverage), cov_low = nz(f$properties$cov_low),
       cov_high = nz(f$properties$cov_high), herd = nz(f$properties$herd_immune_fraction))
})

assign_county <- function(x, y) {
  for (c in counties) {
    if (x < c$xr[1] || x > c$xr[2] || y < c$yr[1] || y > c$yr[2]) next
    if (point_in_ring(x, y, c$ring)) return(c$name)
  }
  NA_character_
}

# school points -> id, name, overall coverage, county (via PIP)
sch <- rbindlist(lapply(schools_geo, function(f) {
  xy <- f$geometry$coordinates
  data.table(location_id = nz(f$properties$location_id), school_name = nz(f$properties$NAME),
             coverage = nz(f$properties$coverage), ci_low = nz(f$properties$cov_low),
             ci_high = nz(f$properties$cov_high), x = xy[[1]], y = xy[[2]])
}))
sch[, county_name := mapply(assign_county, x, y)]
message(sprintf("schools assigned to a county: %d/%d", sum(!is.na(sch$county_name)), nrow(sch)))

# ---- per-grade wide from estimates.csv ----
est <- fread(file.path(IN, "estimates.csv"))
est[, grade := GRADE_LAB[age_group]]
wide_val <- function(col, prefix) {
  d <- dcast(est, id ~ grade, value.var = col); setnames(d, GRADE_LAB, paste0(prefix, GRADE_LAB)); d
}
pg  <- wide_val("est", "coverage_")
plo <- wide_val("ci_low", "coverage_ci_low_")
phi <- wide_val("ci_high", "coverage_ci_high_")
pen <- est[, .(enrollment = max(population, na.rm = TRUE)), by = id]   # enrollment = max across grades

# #58: the upstream estimates carry an is_est flag, but the dashboard no longer
# surfaces the estimated-vs-reported distinction, so it isn't carried through.
schools <- Reduce(function(a,b) merge(a,b,by="id",all=TRUE), list(pg,plo,phi,pen))
# attach identity + overall coverage from geojson points (join id == location_id)
schools <- merge(sch[, .(id = location_id, school_name, county_name,
                         coverage, coverage_ci_low = ci_low, coverage_ci_high = ci_high)],
                 schools, by = "id", all.x = TRUE)
schools[, prob_below_95 := NA_real_]   # not recoverable from point estimates alone
schools[, tier := covtier(coverage)]

# ---- county rows: coverage straight from geojson polygons ----
cty_stat <- schools[!is.na(county_name),
  .(n_schools = .N, pct_schools_below_95 = mean(coverage < THRESHOLD, na.rm=TRUE)), by = county_name]
counties_dt <- rbindlist(lapply(counties, function(c) data.table(
  county = c$name, county_fips = NA_character_,
  coverage = c$coverage, coverage_ci_low = c$cov_low, coverage_ci_high = c$cov_high)))
counties_dt <- merge(counties_dt, cty_stat, by.x="county", by.y="county_name", all.x=TRUE)
for (g in GRADE_LAB) {                       # county per-grade not provided -> blank
  counties_dt[, (paste0("coverage_",g)) := NA_real_]
  counties_dt[, (paste0("coverage_ci_low_",g)) := NA_real_]
  counties_dt[, (paste0("coverage_ci_high_",g)) := NA_real_]
}
counties_dt[, prob_below_95 := NA_real_][, tier := covtier(coverage)]

# ---- state row: enrollment-weighted school overall ----
st_cov <- schools[!is.na(coverage), weighted.mean(coverage, enrollment, na.rm=TRUE)]
state_dt <- data.table(state="nc", state_fips="37", state_name="North Carolina",
  n_schools = nrow(schools),
  pct_schools_below_95 = schools[, mean(coverage < THRESHOLD, na.rm=TRUE)],
  coverage = st_cov, coverage_ci_low = NA_real_, coverage_ci_high = NA_real_)
for (g in GRADE_LAB) {
  state_dt[, (paste0("coverage_",g)) :=
    schools[, weighted.mean(get(paste0("coverage_",g)), enrollment, na.rm=TRUE)]]
  state_dt[, (paste0("coverage_ci_low_",g)) := NA_real_]
  state_dt[, (paste0("coverage_ci_high_",g)) := NA_real_]
}
state_dt[, prob_below_95 := NA_real_][, tier := covtier(coverage)]

# ---- write #20 schema (shared column order with build_state.R) ----
cov_block <- c("coverage","coverage_ci_low","coverage_ci_high",
  paste0("coverage_",GRADE_LAB), paste0("coverage_ci_low_",GRADE_LAB),
  paste0("coverage_ci_high_",GRADE_LAB),
  "prob_below_95","tier")
rnd <- function(d){for(c in names(d)) if(is.numeric(d[[c]])) d[[c]]<-round(d[[c]],4); d}
slug <- "nc"
dir.create(file.path(OUT,"states",slug,"counties"), recursive=TRUE, showWarnings=FALSE)

fwrite(rnd(counties_dt[, c("county","county_fips","n_schools","pct_schools_below_95",cov_block), with=FALSE]),
       file.path(OUT,"states",paste0(slug,".csv")))
for (cn in unique(schools[!is.na(county_name)]$county_name)) {
  s <- schools[county_name==cn, c("id","school_name","enrollment",cov_block), with=FALSE]
  setnames(s, "id", "school_id")
  fwrite(rnd(s), file.path(OUT,"states",slug,"counties",paste0(slugify(cn),".csv")))
}
# combined states/<slug>/schools.csv (one fetch for the app loader; carries county)
# NC comes pre-predicted with every school placed, so there are no fit-missing
# schools: no_data is always 0. lon/lat are left blank (the geojson points are in
# NC State Plane, not WGS84); the map falls back to deterministic in-polygon
# placement for NC, as it did before. Columns included for schema parity with CA.
schools_all <- schools[!is.na(county_name),
  c("id","school_name","county_name","enrollment",cov_block), with=FALSE]
setnames(schools_all, c("id","county_name"), c("school_id","county"))
schools_all[, `:=`(lon = NA_real_, lat = NA_real_, no_data = 0L)]
setcolorder(schools_all, c("school_id","school_name","county","enrollment",
                           "lon","lat","no_data", cov_block))
fwrite(rnd(schools_all), file.path(OUT,"states",slug,"schools.csv"))
states_csv <- file.path(OUT,"states.csv")
st_row <- state_dt[, c("state","state_fips","state_name","n_schools","pct_schools_below_95",cov_block), with=FALSE]
if (file.exists(states_csv)) { cur <- fread(states_csv); cur <- cur[state!=slug]; st_row <- rbind(cur, st_row, fill=TRUE) }
fwrite(rnd(st_row), states_csv)
message("wrote NC CSVs under ", OUT)
