-- ==========================================================================
-- Acadex: Official Course Catalog (Ders Agaci) for course-aware AI & Ders Agaci page
--
-- This migration is NOT applied automatically -- run it yourself via:
--   1. Supabase Studio -> SQL Editor -> paste and run, or
--   2. `supabase db push` if you use the Supabase CLI with this repo linked.
--
-- Adds:
--   1. departments -- lookup table (4 rows), department.name matches the exact
--      free-text values already used in profiles.department / register.html.
--   2. courses -- the official curriculum ('ders agaci') per department: course
--      code, course name, and class year (1-4). Seeded from the 4 curriculum
--      PDFs (BF, BUS, ITB, MIS).
--   3. Both tables are publicly readable (anon + authenticated) since this is a
--      shared reference catalog, not user data; writes are admin-only.
--
-- This does NOT change documents/study_cards.course_tag or its data -- it stays
-- a free-text field. The summarize-document / merge-summarize Edge Functions are
-- updated separately (in the same change set) to look up a student's department
-- courses from this catalog and steer the AI's suggested_course_tag toward an
-- exact catalog match when the content supports it, instead of a pure guess.
-- ==========================================================================

create table if not exists public.departments (
  code text primary key,
  name text not null unique,       -- exact match to profiles.department values
  name_tr text,
  created_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  department_code text not null references public.departments(code) on delete cascade,
  course_code text not null unique,
  course_name text not null,
  year_level int,                   -- 1-4 (Sinif), nullable if unspecified
  created_at timestamptz not null default now()
);

create index if not exists courses_department_idx on public.courses (department_code);
create index if not exists courses_year_level_idx on public.courses (year_level);

alter table public.departments enable row level security;
alter table public.courses enable row level security;

drop policy if exists "departments_select_all" on public.departments;
create policy "departments_select_all"
  on public.departments for select
  to anon, authenticated
  using (true);

drop policy if exists "departments_admin_write" on public.departments;
create policy "departments_admin_write"
  on public.departments for all
  to authenticated
  using (public.current_is_admin())
  with check (public.current_is_admin());

drop policy if exists "courses_select_all" on public.courses;
create policy "courses_select_all"
  on public.courses for select
  to anon, authenticated
  using (true);

drop policy if exists "courses_admin_write" on public.courses;
create policy "courses_admin_write"
  on public.courses for all
  to authenticated
  using (public.current_is_admin())
  with check (public.current_is_admin());

-- --------------------------------------------------------------------------
-- Seed: 4 departments (name matches profiles.department / register.html exactly)
-- --------------------------------------------------------------------------
insert into public.departments (code, name, name_tr) values
  ('MIS', 'Management Information Systems', 'Yönetim Bilişim Sistemleri'),
  ('BUS', 'Business Administration', 'İşletme'),
  ('ITB', 'International Trade and Business', 'Uluslararası Ticaret ve İşletmecilik'),
  ('BF', 'Banking and Finance', 'Finans ve Bankacılık')
on conflict (code) do update set name = excluded.name, name_tr = excluded.name_tr;

-- --------------------------------------------------------------------------
-- Seed: course catalog (197 courses across 4 departments)
-- --------------------------------------------------------------------------
insert into public.courses (department_code, course_code, course_name, year_level) values
  ('BF', 'BF202', 'FINANCIAL MANAGEMENT', 2),
  ('BF', 'BF204', 'INTRODUCTION TO BANKING', 2),
  ('BF', 'BF301', 'ECONOMETRICS I', 3),
  ('BF', 'BF302', 'ECONOMETRICS II', 3),
  ('BF', 'BF303', 'COMPUTING FOR FINANCE', 3),
  ('BF', 'BF304', 'FINANCIAL MARKETS AND INSTITUTIONS', 3),
  ('BF', 'BF305', 'FINANCIAL STATEMENT ANALYSIS', 3),
  ('BF', 'BF306', 'FINANCIAL DATA ANALYTICS', 3),
  ('BF', 'BF307', 'CORPORATE FINANCE', 3),
  ('BF', 'BF308', 'INVESTMENT', 3),
  ('BF', 'BF309', 'REAL ESTATE FINANCE', 3),
  ('BF', 'BF310', 'MULTIVARIATE STATISTICAL ANALYSIS', 3),
  ('BF', 'BF311', 'BEHAVIORAL FINANCE', 3),
  ('BF', 'BF401', 'INTERNATIONAL FINANCE', 4),
  ('BF', 'BF402', 'BANK MANAGEMENT', 4),
  ('BF', 'BF404', 'FINANCIAL MODELING', 4),
  ('BF', 'BF407', 'DIGITAL FINANCE', 4),
  ('BF', 'BF409', 'CREDIT ANALYSIS AND ALLOCATION', 4),
  ('BF', 'BF411', 'TIME SERIES ANALYSIS', 4),
  ('BF', 'BF413', 'PROJECT FINANCE', 4),
  ('BF', 'BF415', 'MANAGERIAL ECONOMICS', 4),
  ('BF', 'BF417', 'PORTFOLIO MANAGEMENT', 4),
  ('BF', 'BF418', 'DERIVATIVES', 4),
  ('BF', 'BF419', 'FIRM ANALYSIS AND VALUATION', 4),
  ('BF', 'BF422', 'EXPORT FINANCING AND EXIMBANK APPLICATIONS', 4),
  ('BF', 'BF424', 'MONETARY POLICY AND CENTRAL BANKING', 4),
  ('BF', 'BF426', 'FINANCIAL STRUCTURE OF BANKING SECTOR', 4),
  ('BUS', 'BUS102', 'SCIENTIFIC RESEARCH AND REPORT WRITING', 1),
  ('BUS', 'BUS103', 'CALCULUS FOR BUSINESS I', 1),
  ('BUS', 'BUS104', 'CALCULUS FOR BUSINESS II', 1),
  ('BUS', 'BUS105', 'ACCOUNTING I', 1),
  ('BUS', 'BUS106', 'ACCOUNTING II', 1),
  ('BUS', 'BUS107', 'INTRODUCTION TO BUSINESS', 1),
  ('BUS', 'BUS109', 'FUNDAMENTALS OF LAW', 1),
  ('BUS', 'BUS110', 'SOCIAL PSYCHOLOGY', 1),
  ('BUS', 'BUS112', 'INTRODUCTION TO SOCIOLOGY', 1),
  ('BUS', 'BUS201', 'STATISTICS FOR BUSINESS I', 2),
  ('BUS', 'BUS202', 'STATISTICS FOR BUSINESS II', 2),
  ('BUS', 'BUS203', 'BUSINESS LAW', 2),
  ('BUS', 'BUS204', 'ORGANIZATIONAL BEHAVIOUR', 2),
  ('BUS', 'BUS205', 'INTRODUCTION TO ACCOUNTING', 2),
  ('BUS', 'BUS208', 'HUMAN RESOURCE MANAGEMENT', 2),
  ('BUS', 'BUS210', 'INTRODUCTION TO MARKETING', 2),
  ('BUS', 'BUS211', 'HISTORY OF SCIENCE AND TECHNOLOGY', 2),
  ('BUS', 'BUS300', 'STAJ', 3),
  ('BUS', 'BUS301', 'STRATEGIC MANAGEMENT', 3),
  ('BUS', 'BUS303', 'LEADERSHIP AND MANAGERIAL SKILLS', 3),
  ('BUS', 'BUS306', 'PRODUCTION AND SERVICES MANAGEMENT', 3),
  ('BUS', 'BUS308', 'COST ACCOUNTING', 3),
  ('BUS', 'BUS315', 'BUSINESS COMMUNICATION', 3),
  ('BUS', 'BUS316', 'COLLECTIVE INTELLIGENCE', 3),
  ('BUS', 'BUS317', 'TEAMWORK AND GROUP DYNAMICS', 3),
  ('BUS', 'BUS318', 'SUSTAINABILITY AND BUSINESS', 3),
  ('BUS', 'BUS321', 'BUSINESS HISTORY IN TURKEY', 3),
  ('BUS', 'BUS322', 'COMPARATIVE BUSINESS SYSTEMS', 3),
  ('BUS', 'BUS323', 'QUALITATIVE RESEARCH', 3),
  ('BUS', 'BUS324', 'CROSS-CULTURAL MANAGEMENT', 3),
  ('BUS', 'BUS326', 'RESEARCH METHODS', 3),
  ('BUS', 'BUS327', 'PUBLIC RELATIONS', 3),
  ('BUS', 'BUS328', 'EU RELATIONS AND REGULATIONS', 3),
  ('BUS', 'BUS329', 'MARKETING MANAGEMENT AND STRATEGY', 3),
  ('BUS', 'BUS330', 'WORKING CAPITAL MANAGEMENT', 3),
  ('BUS', 'BUS331', 'HUMAN RESOURCE PLANNING AND DEVELOPMENT', 3),
  ('BUS', 'BUS332', 'INTERNATIONAL HUMAN RESOURCE MANAGEMENT', 3),
  ('BUS', 'BUS333', 'ENGLISH FOR BUSINESS I', 3),
  ('BUS', 'BUS334', 'DIGITAL MARKETING', 3),
  ('BUS', 'BUS336', 'ENGLISH FOR BUSINESS II', 3),
  ('BUS', 'BUS401', 'BUSINESS ETHICS AND CORPORATE SOCIAL RESPONSIBILITY', 4),
  ('BUS', 'BUS402', 'TURKISH BUSINESS CONTEXT', 4),
  ('BUS', 'BUS403', 'INNOVATION AND ENTREPRENEURSHIP', 4),
  ('BUS', 'BUS404', 'INTERORGANIZATIONAL RELATIONS', 4),
  ('BUS', 'BUS406', 'BUSINESS POLICIES', 4),
  ('BUS', 'BUS407', 'INTERNATIONAL FINANCIAL REPORTING STANDARDS', 4),
  ('BUS', 'BUS409', 'DATA SCIENCE FOR BUSINESS', 4),
  ('BUS', 'BUS410', 'ORGANIZATION THEORY', 4),
  ('BUS', 'BUS412', 'IMPACT EVALUATION METHOD', 4),
  ('BUS', 'BUS414', 'DECISION MAKING TECHNIQUES', 4),
  ('BUS', 'BUS418', 'MACHINE LEARNING FOR BUSINESS', 4),
  ('BUS', 'BUS420', 'ARTIFICIAL INTELLIGENCE AND BUSINESS STRATEGY', 4),
  ('BUS', 'BUS421', 'PROJECT MANAGEMENT', 4),
  ('BUS', 'BUS422', 'BUSINESS PLAN DEVELOPMENT', 4),
  ('BUS', 'BUS423', 'BUSINESS IN SME''S', 4),
  ('BUS', 'BUS424', 'ORGANIZATIONAL DEVELOPMENT AND CHANGE', 4),
  ('BUS', 'BUS425', 'INNOVATION AND INDUSTRIAL CLUSTERS', 4),
  ('BUS', 'BUS426', 'STRATEGIC THINKING AND CASES', 4),
  ('BUS', 'BUS427', 'GLOBALIZATION AND BUSINESS', 4),
  ('BUS', 'BUS428', 'SPECIAL TOPICS IN ORGANIZATIONS', 4),
  ('BUS', 'BUS429', 'SUSTAINABLE VALUE CHAIN MANAGEMENT', 4),
  ('BUS', 'BUS430', 'AUDITING', 4),
  ('BUS', 'BUS431', 'CAREER MANAGEMENT', 4),
  ('BUS', 'BUS434', 'TECHNICAL ANALYSIS AND APPLICATIONS IN STOCK EXCHANGE', 4),
  ('BUS', 'BUS435', 'CONSUMER BEHAVIOR', 4),
  ('BUS', 'BUS436', 'BUSINESS CONTINUITY MANAGEMENT', 4),
  ('BUS', 'BUS437', 'NEGOTIATION AND CONFLICT MANAGEMENT', 4),
  ('BUS', 'BUS438', 'PERFORMANCE AND COMPENSATION MANAGEMENT', 4),
  ('BUS', 'BUS442', 'ENTERPRISE RESOURCE PLANNING', 4),
  ('BUS', 'BUS444', 'STRATEGIC BRAND MANAGEMENT', 4),
  ('ITB', 'ITB101', 'INTRODUCTION TO ECONOMICS I', 1),
  ('ITB', 'ITB102', 'INTRODUCTION TO ECONOMICS II', 1),
  ('ITB', 'ITB207', 'INTERNATIONAL BUSINESS', 2),
  ('ITB', 'ITB302', 'INTERNATIONAL TRADE AND BUSINESS LAW', 3),
  ('ITB', 'ITB305', 'EVOLUTION OF MULTINATIONAL ENTERPRISES', 3),
  ('ITB', 'ITB306', 'EXPORT IMPORT MANAGEMENT', 3),
  ('ITB', 'ITB308', 'GLOBAL ECONOMIC ACTORS AND TRADE POLICY', 3),
  ('ITB', 'ITB311', 'INTERNATIONAL ECONOMICS I', 3),
  ('ITB', 'ITB312', 'INTERNATIONAL ECONOMICS II', 3),
  ('ITB', 'ITB313', 'GLOBAL ENTREPRENEURSHIP AND TRADE', 3),
  ('ITB', 'ITB321', 'CORPORATIVE BUSINESS CULTURE', 3),
  ('ITB', 'ITB323', 'INTERNATIONAL MARKETING STRATEGY', 3),
  ('ITB', 'ITB325', 'CONTEMPORARY DEBATES IN INTERNATIONAL TRADE', 3),
  ('ITB', 'ITB327', 'TRADE AND BUSINESS ETHICS', 3),
  ('ITB', 'ITB329', 'FOREIGN DIRECT INVESTMENT PRACTICES', 3),
  ('ITB', 'ITB331', 'INTEGRATED MARKETING COMMUNICATION IN INTERNATIONAL TRADE', 3),
  ('ITB', 'ITB332', 'INTERNATIONAL INNOVATION SYSTEMS', 3),
  ('ITB', 'ITB334', 'INTERNATIONAL MANAGEMENT APPLICATIONS', 3),
  ('ITB', 'ITB338', 'INTERNATIONAL LOGISTIC MANAGEMENT', 3),
  ('ITB', 'ITB342', 'INTERNATIONAL NEGOTIATIONS AND SALES MANAGEMENT', 3),
  ('ITB', 'ITB344', 'INTERNATIONAL BUSINESS II', 3),
  ('ITB', 'ITB405', 'GLOBAL STRATEGIC MANAGEMENT', 4),
  ('ITB', 'ITB406', 'NATIONS, POLITICS AND MARKETS', 4),
  ('ITB', 'ITB407', 'INTERNATIONAL ORGANIZATIONS', 4),
  ('ITB', 'ITB408', 'ECONOMIC INTEGRATION', 4),
  ('ITB', 'ITB410', 'CORPORATE SUSTAINABILITY PRACTICES: GLOBAL FRAMEWORKS AND REPORTING STANDARDS', 4),
  ('ITB', 'ITB411', 'LOGISTICS MANAGEMENT', 4),
  ('ITB', 'ITB413', 'APPLIED DATA ANALYSIS I', 4),
  ('ITB', 'ITB414', 'APPLIED DATA ANALYSIS II', 4),
  ('ITB', 'ITB416', 'GLOBAL ECONOMIC DEVELOPMENTS AND THEIR IMPLICATIONS FOR BUSINESS', 4),
  ('ITB', 'ITB424', 'FOREIGN DIRECT INVESTMENT PRACTICES', 4),
  ('ITB', 'ITB426', 'HUMAN RESOURCE INFORMATION SYSTEMS', 4),
  ('ITB', 'ITB427', 'REGULATION AND COMPETITION', 4),
  ('ITB', 'ITB428', 'RISK MANAGEMENT FOR INTERNATIONAL BUSINESS', 4),
  ('ITB', 'ITB430', 'INTERNATIONAL MANAGEMENT AND LABOUR MARKET', 4),
  ('ITB', 'ITB432', 'TAXATION IN INTERNATIONAL TRADE', 4),
  ('ITB', 'ITB434', 'CURRENT ISSUES IN INTERNATIONAL ECONOMICS', 4),
  ('ITB', 'ITB435', 'GLOBAL LEADERSHIP', 4),
  ('ITB', 'ITB436', 'GLOBAL CORPORATE GOVERNANCE', 4),
  ('ITB', 'ITB437', 'BUSINESS ANALYSIS AND VALUATION', 4),
  ('ITB', 'ITB438', 'FOREIGN DIRECT INVESTMENT', 4),
  ('ITB', 'ITB439', 'BUSINESS FORECASTING', 4),
  ('ITB', 'ITB440', 'QUALITATIVE RESEARCH', 4),
  ('ITB', 'ITB446', 'TURKISH ECONOMY', 4),
  ('ITB', 'ITB448', 'INTERNATIONAL SERVICE TRADE', 4),
  ('ITB', 'ITB450', 'INTERNATIONAL RETAILING AND FRANCHISING', 4),
  ('MIS', 'MIS104', 'INTRODUCTION TO INFORMATION SYSTEMS', 1),
  ('MIS', 'MIS105', 'INTRODUCTION TO ALGORITHMS AND PROGRAMMING', 1),
  ('MIS', 'MIS112', 'COMPUTER PROGRAMMING I', 1),
  ('MIS', 'MIS204', 'DATABASE MANAGEMENT', 2),
  ('MIS', 'MIS206', 'C PROGRAMMING', 2),
  ('MIS', 'MIS208', 'DETERMINISTIC OPERATIONS RESEARCH', 2),
  ('MIS', 'MIS209', 'INTRODUCTION TO MANAGEMENT SCIENCE', 2),
  ('MIS', 'MIS210', 'COMPUTER NETWORKS AND SECURITY', 2),
  ('MIS', 'MIS213', 'E-BUSINESS', 2),
  ('MIS', 'MIS215', 'COMPUTER PROGRAMMING II', 2),
  ('MIS', 'MIS217', 'FUNDAMENTALS OF INFORMATION TECHNOLOGIES', 2),
  ('MIS', 'MIS301', 'WEB PROGRAMMING', 3),
  ('MIS', 'MIS303', 'SOFTWARE DEVELOPMENT', 3),
  ('MIS', 'MIS305', 'OPERATING SYSTEMS', 3),
  ('MIS', 'MIS307', 'INFORMATION SYSTEM ANALYSIS AND DESIGN', 3),
  ('MIS', 'MIS310', 'PROBABILITY', 3),
  ('MIS', 'MIS311', 'INFORMATION SECURITY SYSTEMS DESIGN AND APPLICATIONS', 3),
  ('MIS', 'MIS312', 'DATA STRUCTURES AND ALGORITHMS', 3),
  ('MIS', 'MIS321', 'OPERATIONS MANAGEMENT I', 3),
  ('MIS', 'MIS322', 'OPERATIONS MANAGEMENT II', 3),
  ('MIS', 'MIS342', 'APPLICATIONS IN STATISTICS', 3),
  ('MIS', 'MIS351', 'GRAPHICAL USER INTERFACE DESIGN AND PROGRAMMING', 3),
  ('MIS', 'MIS353', 'MANAGEMENT OF IS PROJECTS', 3),
  ('MIS', 'MIS362', 'INNOVATION AND TECHNOLOGY MANAGEMENT', 3),
  ('MIS', 'MIS372', 'FORECASTING', 3),
  ('MIS', 'MIS374', 'SIMULATION', 3),
  ('MIS', 'MIS375', 'STOCHASTIC OPERATIONS RESEARCH', 3),
  ('MIS', 'MIS376', 'KNOWLEDGE MAPPING AND DATA VISUALIZATION', 3),
  ('MIS', 'MIS377', 'ADVANCED DATABASE MANAGEMENT SYSTEMS', 3),
  ('MIS', 'MIS379', 'BLOCKCHAIN BASED INFORMATION SYSTEMS DESIGN AND APPLICATIONS', 3),
  ('MIS', 'MIS381', 'DIGITAL SYSTEMS', 3),
  ('MIS', 'MIS392', 'INVENTORY THEORY', 3),
  ('MIS', 'MIS394', 'INTERNET OF THINGS', 3),
  ('MIS', 'MIS402', 'BUSINESS INTELLIGENCE AND DATA MINING', 4),
  ('MIS', 'MIS403', 'INTRODUCTION TO ARTIFICIAL INTELLIGENCE', 4),
  ('MIS', 'MIS404', 'HUMAN-COMPUTER INTERACTION', 4),
  ('MIS', 'MIS405', 'FUZZY SYSTEMS', 4),
  ('MIS', 'MIS406', 'INTRODUCTION TO SOCIAL NETWORK ANALYSIS', 4),
  ('MIS', 'MIS408', 'MOBILE APPLICATION DESIGN AND DEVELOPMENT', 4),
  ('MIS', 'MIS410', 'INFORMATION LAW', 4),
  ('MIS', 'MIS425', 'TECHNOLOGY AND SOCIETY', 4),
  ('MIS', 'MIS441', 'ENTERPRISE INFORMATION SYSTEMS', 4),
  ('MIS', 'MIS442', 'ADVANCED MANAGEMENT INFORMATION SYSTEMS', 4),
  ('MIS', 'MIS446', 'E-GOVERNMENT AND PUBLIC TRANSFORMATION', 4),
  ('MIS', 'MIS453', 'SOCIAL MEDIA', 4),
  ('MIS', 'MIS471', 'APPLIED OPERATIONS RESEARCH', 4),
  ('MIS', 'MIS472', 'QUEUEING THEORY', 4),
  ('MIS', 'MIS475', 'SMART CITIES AND SYSTEMS', 4),
  ('MIS', 'MIS476', 'PRINCIPLES OF SOFTWARE TESTING', 4),
  ('MIS', 'MIS479', 'INFORMATION SYSTEM QUALITY ASSURANCE', 4),
  ('MIS', 'MIS488', 'DIGITAL FORENSICS', 4),
  ('MIS', 'MIS492', 'SUPPLY CHAIN MANAGEMENT', 4),
  ('MIS', 'MIS497', 'SENIOR PROJECT I', 4),
  ('MIS', 'MIS498', 'SENIOR PROJECT II', 4)
on conflict (course_code) do update set course_name = excluded.course_name, year_level = excluded.year_level, department_code = excluded.department_code;

-- ==========================================================================
-- After running this file, the AI course-detection upgrade and the new
-- 'Ders Agaci' browsing page (ders-agaci.html) will start working -- no
-- further manual step needed for this migration itself.
-- ==========================================================================
