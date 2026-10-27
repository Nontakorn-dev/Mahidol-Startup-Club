-- Members who pick "Domain expert" say which field (การแพทย์, กฎหมาย, เกษตร…). Shown on their profile.
alter table public.profiles add column if not exists domain_expertise text
  check (char_length(domain_expertise) <= 60);
