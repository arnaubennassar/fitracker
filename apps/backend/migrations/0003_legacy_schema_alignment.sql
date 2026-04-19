UPDATE admin_tokens
SET scopes = COALESCE(scopes, '[]')
WHERE scopes IS NULL;

UPDATE admin_tokens
SET token_preview = COALESCE(token_preview, substr(token_hash, CASE WHEN length(token_hash) > 5 THEN length(token_hash) - 5 ELSE 1 END, 6))
WHERE token_preview IS NULL;

UPDATE workout_templates
SET slug = lower(trim(replace(replace(replace(name, ' ', '-'), '/', '-'), '--', '-')))
WHERE slug IS NULL OR slug = '';

UPDATE workout_template_exercises
SET target_reps_min = CAST(substr(target_reps, 1, instr(target_reps, '-') - 1) AS INTEGER),
    target_reps_max = CAST(substr(target_reps, instr(target_reps, '-') + 1) AS INTEGER)
WHERE target_reps IS NOT NULL
  AND instr(target_reps, '-') > 0
  AND (target_reps_min IS NULL OR target_reps_max IS NULL);

UPDATE workout_template_exercises
SET target_reps = CAST(substr(target_reps, 1, CASE WHEN instr(target_reps, '/') > 0 THEN instr(target_reps, '/') - 1 ELSE length(target_reps) END) AS INTEGER)
WHERE target_reps IS NOT NULL
  AND instr(target_reps, '-') = 0
  AND trim(CAST(target_reps AS TEXT)) GLOB '[0-9]*';

CREATE UNIQUE INDEX IF NOT EXISTS workout_templates_slug_idx
  ON workout_templates (slug);
