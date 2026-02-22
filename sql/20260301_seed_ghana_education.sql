-- ============================================================
-- Ghana Education Seed Data
-- MVP reference data for the Ghanaian educational system
-- ============================================================

-- ─── Country ──────────────────────────────────────────────────
INSERT INTO countries (code, name, flag_emoji, official_languages, sort_order)
VALUES ('GH', 'Ghana', '🇬🇭', '{en}', 1)
ON CONFLICT (code) DO NOTHING;

-- ─── Education Levels ─────────────────────────────────────────
INSERT INTO education_levels (country_id, code, name, short_name, category, sort_order, typical_start_age, typical_duration_years)
SELECT c.id, vals.code, vals.name, vals.short_name, vals.category, vals.sort_order, vals.start_age, vals.duration
FROM countries c, (VALUES
    ('gh_jhs',  'Junior High School',   'JHS',  'lower_secondary', 1, 12, 3),
    ('gh_shs',  'Senior High School',   'SHS',  'upper_secondary', 2, 15, 3),
    ('gh_uni',  'University',           'Uni',  'tertiary',        3, 18, 4),
    ('gh_poly', 'Polytechnic / TVET',   'Poly', 'tertiary',        4, 18, 3),
    ('gh_coe',  'College of Education', 'CoE',  'tertiary',        5, 18, 4)
) AS vals(code, name, short_name, category, sort_order, start_age, duration)
WHERE c.code = 'GH'
ON CONFLICT (code) DO NOTHING;

-- ─── Curricula ────────────────────────────────────────────────
INSERT INTO curricula (country_id, education_level_id, code, name, governing_body)
SELECT c.id, el.id, vals.cur_code, vals.cur_name, vals.body
FROM countries c
JOIN education_levels el ON el.country_id = c.id
CROSS JOIN (VALUES
    ('gh_jhs',  'gh_bece',   'BECE',   'WAEC'),
    ('gh_shs',  'gh_wassce', 'WASSCE', 'WAEC')
) AS vals(level_code, cur_code, cur_name, body)
WHERE c.code = 'GH' AND el.code = vals.level_code
ON CONFLICT (code) DO NOTHING;

-- ─── Examinations ─────────────────────────────────────────────
INSERT INTO examinations (curriculum_id, code, name, typical_date, recurrence)
SELECT cur.id, vals.code, vals.name, vals.exam_date, vals.recurrence
FROM curricula cur
CROSS JOIN (VALUES
    ('gh_bece',   'bece_2026',   'BECE 2026',   '2026-06-15'::date, 'annual'),
    ('gh_bece',   'bece_2027',   'BECE 2027',   '2027-06-15'::date, 'annual'),
    ('gh_wassce', 'wassce_2026', 'WASSCE 2026', '2026-08-01'::date, 'annual'),
    ('gh_wassce', 'wassce_2027', 'WASSCE 2027', '2027-08-01'::date, 'annual')
) AS vals(cur_code, code, name, exam_date, recurrence)
WHERE cur.code = vals.cur_code
ON CONFLICT (code) DO NOTHING;

-- ─── Subjects: WASSCE (SHS) ──────────────────────────────────
INSERT INTO subjects (curriculum_id, code, name, category, sort_order)
SELECT cur.id, vals.code, vals.name, vals.cat, vals.sort
FROM curricula cur
CROSS JOIN (VALUES
    ('math_core',      'Core Mathematics',          'core',     1),
    ('eng_lang',       'English Language',           'core',     2),
    ('int_science',    'Integrated Science',         'core',     3),
    ('social_studies', 'Social Studies',             'core',     4),
    ('elective_math',  'Elective Mathematics',       'elective', 5),
    ('physics',        'Physics',                    'elective', 6),
    ('chemistry',      'Chemistry',                  'elective', 7),
    ('biology',        'Biology',                    'elective', 8),
    ('economics',      'Economics',                  'elective', 9),
    ('geography',      'Geography',                  'elective', 10),
    ('gov',            'Government',                 'elective', 11),
    ('history',        'History',                    'elective', 12),
    ('french',         'French',                     'elective', 13),
    ('ict',            'Information & Comm. Tech.',   'elective', 14),
    ('accounting',     'Financial Accounting',        'elective', 15),
    ('bus_mgmt',       'Business Management',         'elective', 16)
) AS vals(code, name, cat, sort)
WHERE cur.code = 'gh_wassce'
ON CONFLICT (curriculum_id, code) DO NOTHING;

-- ─── Subjects: BECE (JHS) ────────────────────────────────────
INSERT INTO subjects (curriculum_id, code, name, category, sort_order)
SELECT cur.id, vals.code, vals.name, vals.cat, vals.sort
FROM curricula cur
CROSS JOIN (VALUES
    ('eng_lang',       'English Language',           'core', 1),
    ('mathematics',    'Mathematics',                'core', 2),
    ('int_science',    'Integrated Science',         'core', 3),
    ('social_studies', 'Social Studies',             'core', 4),
    ('rme',            'Religious & Moral Education','core', 5),
    ('ict',            'Information & Comm. Tech.',  'core', 6),
    ('ghanaian_lang',  'Ghanaian Language',          'core', 7),
    ('french',         'French',                     'elective', 8),
    ('bdt',            'Basic Design & Technology',  'elective', 9),
    ('creative_arts',  'Creative Arts',              'elective', 10)
) AS vals(code, name, cat, sort)
WHERE cur.code = 'gh_bece'
ON CONFLICT (curriculum_id, code) DO NOTHING;
