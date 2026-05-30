# Generic imuGAP -> dashboard CSV producer (#20).
#
# State-agnostic: give it a fitted imuGAP object + the standardized
# tidyschoolvax/run_imugap outputs (cleaned_data, linkage_key) + state metadata,
# and it emits the #20 schema:
#   <out>/states.csv                          (one row per state; appended)
#   <out>/states/<slug>.csv                   (one row per county)
#   <out>/states/<slug>/counties/<cty>.csv    (one row per school)
#
# Approach settled in probe_aggregate.R: coverage at every level = predict() at
# that loc_id NODE (state=root, counties=layer2, schools=layer3), grades K-5 =
# ages 5-10 taken as a single-year cross-section via create_target(mode="snapshot").
#
# Modes:
#   FIT_PATH=<rds>            real run (also needs CLEANED_PATH, LINKAGE_PATH, STATE)
#   STUB=1                    join/format test on real inputs w/ placeholder coverage
suppressMessages({library(imuGAP); library(data.table)})

GRADE_AGES <- 5:10
GRADE_LAB  <- c("K", "1", "2", "3", "4", "5")   # age 5 -> K ... age 10 -> 5th
THRESHOLD  <- 0.95

slugify <- function(x) gsub("[^a-z0-9]+", "-", tolower(trimws(x)))
# linkage_key and cleaned_data use DIFFERENT school_id systems, so we bridge
# them on normalized school-name + county (96% match; ids don't correspond).
norm_name <- function(x) {
  x <- tolower(trimws(x)); x <- gsub("[[:punct:]]", " ", x)
  x <- gsub("\\b(school|schools)\\b", "", x); gsub("\\s+", " ", trimws(x))
}
nm_key <- function(name, county) paste(norm_name(name), norm_name(county), sep = "|")
covtier  <- function(v) ifelse(is.na(v), NA_character_,
                               ifelse(v >= 0.95, "H", ifelse(v >= 0.90, "M", "L")))
# Title-case county names so they match the us-atlas polygon names the dashboard
# joins on (linkage_key ships them lowercased, e.g. "los angeles" -> "Los Angeles").
title_case <- function(x) gsub("\\b([a-z])", "\\U\\1", tolower(x), perl = TRUE)

# --- 1. predict coverage at every node, per grade + overall (from the same draws)
# Batched: predicting all ~7936 nodes x 6 grades in one gqs() call exhausts RAM
# (4000 draws x 47616 obs). We chunk the node list, predict each chunk, and
# reduce to per-(loc_id, grade) + per-(loc_id) summaries immediately so only
# summaries (not draws) accumulate. Each loc_id lives wholly in one chunk, so
# overall-coverage CI and prob_below_95 (per-node reductions over draws) stay exact.
predict_coverage <- function(fit, grade_ages = GRADE_AGES, dose = 2L,
                             grade_lab = GRADE_LAB, ref_cohort = NULL,
                             chunk_nodes = as.integer(Sys.getenv("CHUNK_NODES", "800"))) {
  if (is.null(ref_cohort)) {
    ref_cohort <- fit$data$n_cohort - (max(grade_ages) - min(grade_ages))
  }
  loc <- as.data.table(fit$locations)
  glab_map <- setNames(grade_lab, as.character(grade_ages))
  ids <- loc$loc_id
  chunks <- split(ids, ceiling(seq_along(ids) / chunk_nodes))
  message(sprintf("predicting %d nodes x %d grades in %d chunks of <=%d",
                  length(ids), length(grade_ages), length(chunks), chunk_nodes))

  pg <- vector("list", length(chunks)); ov <- vector("list", length(chunks))
  for (i in seq_along(chunks)) {
    target <- create_target(fit, location = chunks[[i]], age = grade_ages,
                            cohort = ref_cohort, dose = dose, mode = "snapshot")
    pred <- as.data.table(predict(fit, target))
    pred[, grade := glab_map[as.character(age)]]
    ct <- build_cov_tables(pred, loc[loc_id %in% chunks[[i]]], grade_lab)
    pg[[i]] <- ct$per_grade; ov[[i]] <- ct$overall
    rm(target, pred, ct); gc(FALSE)
    message(sprintf("  chunk %d/%d done", i, length(chunks)))
  }
  list(per_grade = rbindlist(pg), overall = rbindlist(ov), grade_lab = grade_lab)
}

# shared by real + stub paths: turn long (loc_id, grade, sample_id, p_obs) draws
# into per-grade + overall summaries keyed by loc_id, tagged with level.
build_cov_tables <- function(pred, loc, grade_lab = GRADE_LAB) {
  pred <- copy(as.data.table(pred)); pred[, loc_id := as.character(loc_id)]
  loc  <- copy(as.data.table(loc));  loc[,  loc_id := as.character(loc_id)]
  per_grade <- pred[, .(coverage = mean(p_obs),
                        ci_low   = quantile(p_obs, .025),
                        ci_high  = quantile(p_obs, .975)), by = .(loc_id, grade)]
  overall_draws <- pred[, .(p = mean(p_obs)), by = .(loc_id, sample_id)]
  overall <- overall_draws[, .(coverage = mean(p),
                               ci_low = quantile(p, .025),
                               ci_high = quantile(p, .975),
                               prob_below_95 = mean(p < THRESHOLD)), by = loc_id]
  lvl <- loc[, .(loc_id, level = fifelse(layer == 1L, "state",
                                  fifelse(layer == 2L, "county", "school")))]
  list(per_grade = lvl[per_grade, on = "loc_id"],
       overall   = lvl[overall, on = "loc_id"],
       grade_lab = grade_lab)
}

# --- 2. join identity / enrollment / reported, compute aggregates -> level tables ---
assemble <- function(cov, cleaned, linkage, state_meta, county_fips_map = NULL) {
  cleaned <- copy(as.data.table(cleaned)); linkage <- copy(as.data.table(linkage))
  # normalize join keys to character (school_id/loc_ids differ in type across files)
  for (c in c("school_id", "school_loc_id", "county_loc_id", "county_name"))
    if (c %in% names(linkage)) linkage[[c]] <- as.character(linkage[[c]])
  if ("school_id" %in% names(cleaned)) cleaned[, school_id := as.character(school_id)]
  glab <- cov$grade_lab

  # widen coverage + CIs into the schema's per-grade columns
  w <- function(val, prefix) {
    d <- dcast(cov$per_grade, loc_id ~ grade, value.var = val)
    setnames(d, glab, paste0(prefix, glab)); d
  }
  base <- cov$overall[w("coverage", "coverage_"), on = "loc_id"]
  base <- base[w("ci_low",  "coverage_ci_low_"),  on = "loc_id"]
  base <- base[w("ci_high", "coverage_ci_high_"), on = "loc_id"]
  setnames(base, c("ci_low", "ci_high"), c("coverage_ci_low", "coverage_ci_high"))

  # ---- schools: identity (from linkage, by model loc_id) + enrollment/reported
  #      (from cleaned, bridged on normalized name+county since school_ids differ)
  sch_key <- unique(linkage[, .(loc_id = as.character(school_loc_id), school_id,
                                 school_name, county_name)])
  sch_key[, nm := nm_key(school_name, county_name)]
  cl <- copy(cleaned)[, nm := nm_key(school_name, county_name)]
  enr <- cl[order(year), .SD[.N], by = nm][, .(nm, enrollment, current)]  # latest year
  enr[, reported_K := fifelse(!is.na(enrollment) & enrollment > 0,
                              current / enrollment, NA_real_)]
  sch_key <- enr[sch_key, on = "nm"]
  sch_key[, nm := NULL]
  schools <- sch_key[base[level == "school"], on = "loc_id", nomatch = 0]

  for (g in glab) schools[, (paste0("is_estimated_", g)) := 1L]   # grades 1-5 model
  schools[, is_estimated_K := fifelse(!is.na(reported_K), 0L, 1L)] # K reported if available
  schools[!is.na(reported_K), coverage_K := reported_K]            # override K with reported
  schools[, coverage := rowMeans(.SD), .SDcols = paste0("coverage_", glab)] # overall reflects override
  schools[, tier := covtier(coverage)]

  # ---- per-school below-threshold -> county / state aggregates ----
  below <- schools[, .(school_id, county_name, below = coverage < THRESHOLD)]
  cty_stat <- below[, .(n_schools = .N, pct_schools_below_95 = mean(below)), by = county_name]
  st_stat  <- below[, .(n_schools = .N, pct_schools_below_95 = mean(below))]

  # ---- counties: node-predict coverage + identity + stats ----
  cty_key <- unique(linkage[, .(loc_id = county_loc_id, county_name)])
  counties <- cty_key[base[level == "county"], on = "loc_id", nomatch = 0]
  counties <- cty_stat[counties, on = "county_name"]
  for (g in glab) counties[, (paste0("is_estimated_", g)) := 1L]  # aggregates are model-derived
  counties[, tier := covtier(coverage)]
  counties[, county_fips := if (!is.null(county_fips_map))
    county_fips_map[match(county_name, names(county_fips_map))] else NA_character_]

  # ---- state row ----
  state <- base[level == "state"]
  for (g in glab) state[, (paste0("is_estimated_", g)) := 1L]
  state[, `:=`(state = state_meta$slug, state_fips = state_meta$fips,
               state_name = state_meta$name,
               n_schools = st_stat$n_schools,
               pct_schools_below_95 = st_stat$pct_schools_below_95,
               tier = covtier(coverage))]

  list(schools = schools, counties = counties, state = state, grade_lab = glab)
}

# --- 3. write the three CSV file types in schema column order ---
write_csvs <- function(tab, out_dir, state_meta) {
  glab <- tab$grade_lab
  cov_block <- c("coverage", "coverage_ci_low", "coverage_ci_high",
                 paste0("coverage_", glab),
                 paste0("coverage_ci_low_", glab), paste0("coverage_ci_high_", glab),
                 paste0("is_estimated_", glab), "prob_below_95", "tier")
  rnd <- function(d) { for (c in names(d)) if (is.numeric(d[[c]])) d[[c]] <- round(d[[c]], 4); d }
  slug <- state_meta$slug
  dir.create(file.path(out_dir, "states", slug, "counties"), recursive = TRUE, showWarnings = FALSE)

  # county rows -> states/<slug>.csv
  cty <- tab$counties[, c("county_name", "county_fips", "n_schools",
                          "pct_schools_below_95", cov_block), with = FALSE]
  setnames(cty, "county_name", "county")
  cty[, county := title_case(county)]
  fwrite(rnd(cty), file.path(out_dir, "states", paste0(slug, ".csv")))

  # school rows -> per-county files (canonical download/API unit, #21/#22) ...
  for (cty_name in unique(tab$schools$county_name)) {
    s <- tab$schools[county_name == cty_name,
                     c("school_id", "school_name", "enrollment", cov_block), with = FALSE]
    fwrite(rnd(s), file.path(out_dir, "states", slug, "counties",
                             paste0(slugify(cty_name), ".csv")))
  }
  # ... plus one combined states/<slug>/schools.csv the app loader reads in a
  # single request (carries a `county` column; avoids an N+1 fan-out).
  schools_all <- tab$schools[!is.na(county_name),
    c("school_id", "school_name", "county_name", "enrollment", cov_block), with = FALSE]
  setnames(schools_all, "county_name", "county")
  schools_all[, county := title_case(county)]   # match atlas county names (loader joins on these)
  fwrite(rnd(schools_all), file.path(out_dir, "states", slug, "schools.csv"))

  # state row -> states.csv (create/replace this state's row)
  st <- tab$state[, c("state", "state_fips", "state_name", "n_schools",
                      "pct_schools_below_95", cov_block), with = FALSE]
  states_csv <- file.path(out_dir, "states.csv")
  if (file.exists(states_csv)) {
    cur <- fread(states_csv); cur <- cur[state != slug]
    st <- rbind(cur, st, fill = TRUE)
  }
  fwrite(rnd(st), states_csv)
  invisible(tab)
}

# ============================ driver ============================
OUT <- Sys.getenv("OUT_DIR", unset = "scripts/build-data/out")

if (Sys.getenv("STUB") == "1") {
  message("STUB MODE: placeholder coverage on real loc_ids; tests join + schema output")
  cleaned <- readRDS("scripts/build-data/inputs/cleaned_data.rds")
  linkage <- readRDS("scripts/build-data/inputs/linkage_key.rds")
  locs    <- as.data.table(readRDS("scripts/build-data/inputs/locations.rds"))
  setnames(locs, "id", "loc_id", skip_absent = TRUE)
  state_id <- locs[is.na(parent_id), loc_id]
  locs[, layer := fifelse(loc_id == state_id, 1L,
                   fifelse(parent_id == state_id, 2L, 3L))]
  # fabricate per-draw predictions on the real loc_ids (8 draws, plausible coverage)
  set.seed(1)
  draws <- CJ(loc_id = locs$loc_id, grade = GRADE_LAB, sample_id = 1:8)
  base_cov <- setNames(runif(nrow(locs), 0.85, 0.97), locs$loc_id)
  gbump <- setNames(c(-0.04, 0, .01, .015, .02, .02), GRADE_LAB)
  draws[, p_obs := pmin(0.999, pmax(0.5,
        base_cov[as.character(loc_id)] + gbump[grade] + rnorm(.N, 0, 0.01)))]
  cov <- build_cov_tables(draws, locs)
  meta <- list(slug = "ca", fips = "06", name = "California")
  tab <- assemble(cov, cleaned, linkage, meta)
  write_csvs(tab, OUT, meta)
  message("wrote stub CSVs under ", OUT)
} else if (nzchar(Sys.getenv("FIT_PATH"))) {
  cleaned <- readRDS(Sys.getenv("CLEANED_PATH"))
  linkage <- readRDS(Sys.getenv("LINKAGE_PATH"))
  meta <- list(slug = Sys.getenv("STATE"),
               fips = Sys.getenv("STATE_FIPS"),
               name = Sys.getenv("STATE_NAME"))
  message("REAL RUN for ", meta$slug)
  # cache the expensive predict step so format iteration is cheap
  cache <- Sys.getenv("COV_CACHE", unset = file.path(OUT, "..", "cov_cache.rds"))
  if (file.exists(cache) && Sys.getenv("FORCE_PREDICT") != "1") {
    message("using cached coverage: ", cache)
    cov <- readRDS(cache)
  } else {
    fit <- readRDS(Sys.getenv("FIT_PATH"))
    cov <- predict_coverage(fit)
    dir.create(dirname(cache), recursive = TRUE, showWarnings = FALSE)
    saveRDS(cov, cache); message("cached coverage -> ", cache)
  }
  tab <- assemble(cov, cleaned, linkage, meta)
  write_csvs(tab, OUT, meta)
  message("wrote CSVs under ", OUT)
} else {
  stop("set STUB=1 or FIT_PATH=... (with CLEANED_PATH, LINKAGE_PATH, STATE, STATE_FIPS, STATE_NAME)")
}
