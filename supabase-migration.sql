-- Supabase Migration: Prior Authorization Assistant
-- Paste this into your Supabase SQL Editor (https://app.supabase.com)
-- Go to: SQL Editor → New Query → Paste → Run

-- Patients table
CREATE TABLE IF NOT EXISTS patients (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  age INTEGER,
  diagnosis TEXT NOT NULL,
  requested_procedure TEXT NOT NULL,
  clinical_notes TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Policies table
CREATE TABLE IF NOT EXISTS policies (
  id SERIAL PRIMARY KEY,
  payer_name TEXT NOT NULL UNIQUE,
  policy_text TEXT NOT NULL,
  coverage_rules TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Prior auth cases table
CREATE TABLE IF NOT EXISTS prior_auth_cases (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  payer_id INTEGER NOT NULL REFERENCES policies(id),
  agent_outcome TEXT,
  drafted_letter TEXT,
  missing_documentation TEXT,
  agent_trace TEXT,
  human_review_status TEXT DEFAULT 'pending',
  human_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Eval results table
CREATE TABLE IF NOT EXISTS eval_results (
  id SERIAL PRIMARY KEY,
  case_id INTEGER NOT NULL REFERENCES prior_auth_cases(id),
  expected_outcome TEXT,
  actual_outcome TEXT,
  is_correct INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enable Row Level Security (optional, for future use)
-- ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE policies ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SEED DATA: 15 patients + 1 payer policy
-- ============================================================

-- Insert BlueCross Insurance policy
INSERT INTO policies (payer_name, policy_text, coverage_rules) VALUES (
  'BlueCross Insurance',
  'BlueCross Insurance - Prior Authorization Policy

-- This policy governs prior authorization requirements for medical procedures and services. All requests must meet medical necessity criteria and include required supporting documentation.

GENERAL PRINCIPLES:
BlueCross Insurance follows evidence-based guidelines for determining medical necessity. Procedures must be:
1. Medically necessary for the diagnosis or treatment of a covered condition
2. Not experimental or investigational
3. Provided at the appropriate level of care
4. Supported by adequate clinical documentation',
  '{"MRI lumbar spine":{"criteria":["Diagnosis of chronic lower back pain or suspected lumbar pathology","Conservative treatment attempted for minimum 4 weeks (physical therapy and/or NSAIDs)","Failure of conservative therapy documented in clinical notes","Imaging medically necessary to guide treatment decisions"],"required_docs":["Clinical notes documenting diagnosis","Evidence of conservative treatment (dates, type of therapy)","Justification for imaging based on clinical exam findings"],"decision":"APPROVE if all criteria met; DENY if criteria not met; REQUEST ADDITIONAL INFO if documentation incomplete"},"Continuous Glucose Monitor":{"criteria":["Diagnosis of Type 1 or Type 2 Diabetes","Patient on insulin therapy","Documented hypoglycemic episodes or poor glycemic control","Patient demonstrates ability to use device"],"required_docs":["Documentation of diabetes diagnosis and type","Insulin regimen details","Blood glucose logs showing hypoglycemic episodes or HbA1c","Clinical justification for CGM over standard monitoring"],"decision":"APPROVE if all criteria met; DENY if criteria not met"},"MRI knee without contrast":{"criteria":["Suspected internal derangement of knee","Physical exam findings consistent with meniscal or ligament injury","X-ray negative for fracture","Conservative treatment attempted for minimum 2 weeks"],"required_docs":["Clinical notes documenting injury mechanism and physical exam","X-ray results","Documentation of conservative treatment trial","Justification for MRI over continued conservative management"],"decision":"APPROVE if criteria met; DENY if insufficient conservative treatment; REQUEST ADDITIONAL INFO if documentation incomplete"},"CPAP device":{"criteria":["Diagnosis of obstructive sleep apnea confirmed by sleep study","AHI ≥ 15 events/hour OR AHI ≥ 5 with comorbidities","Patient has tried conservative measures (positional therapy, weight loss counseling if applicable)","Device prescribed by qualified sleep specialist"],"required_docs":["Sleep study report with AHI","Clinical evaluation notes","Documentation of conservative treatment attempts","Prescription from sleep specialist"],"decision":"APPROVE if AHI criteria met with clinical documentation; DENY if AHI below threshold"},"Botox injections for chronic migraine":{"criteria":["Diagnosis of chronic migraine (≥15 headache days/month)","Failed adequate trials of at least 2 preventive medications from different classes","Duration of failed trials minimum 2 months each","Not currently on other preventive medications at therapeutic doses"],"required_docs":["Headache diary or documentation of headache frequency","List of failed preventive medications with dates and reasons for discontinuation","Current medication list","Clinical justification for Botox over remaining oral preventives"],"decision":"APPROVE if criteria fully met; DENY if insufficient failed trials; REQUEST ADDITIONAL INFO if headache diary missing"},"Stress echocardiogram":{"criteria":["Symptoms suggestive of coronary artery disease","Risk factors for CAD present","Non-diagnostic resting EKG","Patient able to exercise adequately"],"required_docs":["Documentation of chest pain or equivalent symptoms","Resting EKG results","Risk factor assessment","Clinical justification for stress imaging over standard stress test"],"decision":"APPROVE if criteria met; DENY if low pre-test probability without risk factors"},"Humira (adalimumab)":{"criteria":["Diagnosis of moderate to severe rheumatoid arthritis","Failed adequate trial of methotrexate (minimum 3 months at therapeutic dose)","DAS28 score > 3.2 indicating active disease","Negative TB screening and hepatitis panel"],"required_docs":["Rheumatologist evaluation notes with DAS28 score","Documentation of methotrexate trial (dose, duration, response)","TB test results","Hepatitis panel results"],"decision":"APPROVE if criteria met; DENY if no DMARD trial; REQUEST ADDITIONAL INFO if TB/hepatitis screening missing"},"Phacoemulsification with IOL implant":{"criteria":["Diagnosis of visually significant cataract","Best corrected visual acuity 20/50 or worse","Cataract impacts activities of daily living","Patient is suitable surgical candidate"],"required_docs":["Ophthalmology exam notes with visual acuity","Documentation of impact on daily activities","Glare testing results if performed","Pre-operative clearance if indicated"],"decision":"APPROVE if visual acuity threshold met; DENY if vision correctable with glasses"},"ACL reconstruction surgery":{"criteria":["MRI-confirmed complete ACL tear","Patient reports functional instability","Failed adequate trial of conservative management OR high-demand athlete","Pre-habilitation physical therapy completed"],"required_docs":["MRI report confirming tear","Physical exam documentation of instability","Physical therapy notes from pre-habilitation","Surgical clearance evaluation"],"decision":"APPROVE if criteria met; DENY if no instability or conservative trial for non-athletes"},"Epidural steroid injection":{"criteria":["Radicular pain with dermatomal distribution","MRI-confirmed disc herniation or stenosis at corresponding level","Failed conservative treatment including oral medications for minimum 3 weeks","Pain severity VAS ≥ 4/10"],"required_docs":["MRI report showing pathology at appropriate level","Documentation of radicular symptoms","Failed conservative treatment notes","Pain assessment scores"],"decision":"APPROVE if criteria met; REQUEST ADDITIONAL INFO if MRI not yet obtained"},"Total knee arthroplasty":{"criteria":["Diagnosis of end-stage osteoarthritis with bone-on-bone changes on imaging","Failed conservative treatment for minimum 12 weeks","Failed trial of injections (corticosteroid or viscosupplementation)","Pain significantly limits activities of daily living","BMI < 40 or documented weight management efforts"],"required_docs":["X-ray report showing bone-on-bone changes","Documentation of conservative treatment duration and modalities","Injection history","Functional status assessment","Pre-operative medical clearance"],"decision":"APPROVE if criteria met; DENY if BMI > 40 without weight management; REQUEST ADDITIONAL INFO if conservative trial insufficient"},"Transcranial magnetic stimulation":{"criteria":["Diagnosis of treatment-resistant major depressive disorder","Failed minimum 3 antidepressant trials from different classes at adequate doses","Duration of each trial minimum 8 weeks","Concurrent psychotherapy for at least 3 months","PHQ-9 score ≥ 15"],"required_docs":["Psychiatric evaluation notes","Documentation of all failed medication trials with dates and doses","PHQ-9 scores pre and post treatment","Psychotherapy attendance records","Safety assessment (no active suicidality, no seizure disorder)"],"decision":"APPROVE if criteria met; DENY if fewer than 3 failed trials; REQUEST ADDITIONAL INFO if psychotherapy documentation missing"},"Uterine fibroid embolization":{"criteria":["Diagnosis of symptomatic uterine fibroids confirmed by imaging","Heavy menstrual bleeding documented","Anemia attributable to menorrhagia (Hgb < 12)","Failed trial of medical management (hormonal therapy) for minimum 3 months","Patient desires uterine preservation"],"required_docs":["Pelvic ultrasound or MRI report","Menstrual history documentation","CBC showing anemia","Documentation of failed medical management","Statement of uterine preservation preference"],"decision":"APPROVE if criteria met; DENY if no medical management trial; REQUEST ADDITIONAL INFO if imaging not obtained"},"Functional endoscopic sinus surgery":{"criteria":["Diagnosis of chronic rhinosinusitis","Minimum 4 episodes of sinusitis in 12 months OR persistent symptoms > 12 weeks","Failed maximal medical therapy including antibiotics, nasal steroids, and saline irrigation","CT sinus showing mucosal disease"],"required_docs":["CT sinus report","Documentation of episodes or persistent symptoms","Records of medical therapy trials","SNOT-22 or equivalent symptom score","Endoscopy findings if performed"],"decision":"APPROVE if criteria met; DENY if medical therapy inadequate; REQUEST ADDITIONAL INFO if CT or endoscopy not obtained"},"Diagnostic laparoscopy":{"criteria":["Suspected endometriosis based on clinical presentation","Chronic pelvic pain > 6 months","Failed trial of medical management (NSAIDs, hormonal therapy) for minimum 3 months","Pelvic exam findings suggestive of endometriosis","Imaging non-diagnostic but high clinical suspicion"],"required_docs":["Detailed pain history and symptom diary","Pelvic exam documentation","Imaging results (ultrasound)","Documentation of failed medical trials","Clinical justification for surgical diagnosis over continued empiric treatment"],"decision":"APPROVE if criteria met; DENY if no medical trial; REQUEST ADDITIONAL INFO if pain diary not provided"}}'
);

-- Insert 15 synthetic patients
INSERT INTO patients (name, age, diagnosis, requested_procedure, clinical_notes) VALUES
('Alice Johnson', 52, 'Chronic lower back pain', 'MRI lumbar spine', 'Patient reports 6 weeks of persistent lower back pain radiating to left leg. Conservative treatment with physical therapy and NSAIDs for 8 weeks without improvement. Imaging needed to rule out disc herniation or spinal stenosis.'),
('Bob Smith', 67, 'Type 2 Diabetes', 'Continuous Glucose Monitor', 'Patient on insulin therapy. Frequent hypoglycemic episodes (3+ per week) despite medication adjustments. CGM warranted for improved glucose control monitoring.'),
('Carol Davis', 38, 'Meniscal tear, right knee', 'MRI knee without contrast', 'Patient sustained sports injury 3 weeks ago. X-ray negative for fracture but physical exam shows joint line tenderness and positive McMurray test. Conservative treatment with RICE protocol and NSAIDs for 2 weeks with persistent symptoms. MRI needed to assess surgical candidacy.'),
('David Martinez', 45, 'Obstructive sleep apnea', 'CPAP device', 'Patient presents with excessive daytime sleepiness, snoring, and witnessed apneas. BMI 34. Home sleep study shows AHI of 28 events/hour. Epworth Sleepiness Scale score 16. Patient reports 6 weeks of positional therapy without improvement. CPAP is medically necessary.'),
('Eva Thompson', 29, 'Migraine without aura', 'Botox injections for chronic migraine', 'Patient has 18 headache days per month. Failed trials of propranolol (3 months), topiramate (2 months, stopped due to cognitive side effects), and amitriptyline (2 months). Currently on no preventive medication. Meets criteria for chronic migraine.'),
('Frank Wilson', 55, 'Coronary artery disease', 'Stress echocardiogram', 'Patient reports chest pain on exertion for 2 weeks. Has history of hypertension and hyperlipidemia. EKG shows nonspecific ST changes. Risk factors: smoker, family history of early CAD. Exercise stress test with imaging indicated to rule out ischemia.'),
('Grace Lee', 41, 'Rheumatoid arthritis', 'Humira (adalimumab)', 'Patient has moderate to severe RA with 8 swollen and 10 tender joints. DAS28 score 5.4. Failed methotrexate 20mg weekly for 6 months. TB test negative. Hepatitis panel negative. Meets ACR criteria for biologic therapy initiation.'),
('Henry Brown', 72, 'Cataract, right eye', 'Phacoemulsification with IOL implant', 'Patient reports progressive blurry vision in right eye over 6 months affecting daily activities including driving and reading. Best corrected visual acuity 20/80. Cataract grade 3+ nuclear sclerotic. Glare testing positive.'),
('Iris Kim', 33, 'Anterior cruciate ligament tear', 'ACL reconstruction surgery', 'Patient sustained injury while skiing 2 weeks ago. MRI confirmed complete ACL tear. Patient is young and active, reporting knee instability with daily activities. Pre-habilitation started with physical therapy. Surgery indicated for functional stability restoration.'),
('Jack Rodriguez', 48, 'Herniated disc L4-L5', 'Epidural steroid injection', 'Patient reports 4 weeks of severe radicular pain down right leg. MRI shows L4-L5 disc herniation with nerve root compression. Failed conservative treatment including oral steroids and gabapentin. Pain VAS score 7/10.'),
('Karen White', 60, 'Osteoarthritis, bilateral knees', 'Total knee arthroplasty, left', 'Patient has end-stage osteoarthritis left knee with bone-on-bone changes on X-ray. Failed conservative treatment including physical therapy for 12 weeks, corticosteroid injections x2, and viscosupplementation. Pain severely limits ambulation. BMI 31.'),
('Larry Green', 44, 'Major depressive disorder', 'Transcranial magnetic stimulation', 'Patient has treatment-resistant depression. Failed trials of sertraline (max dose, 12 weeks), venlafaxine (max dose, 10 weeks), and augmentation with aripiprazole (8 weeks). PHQ-9 score 19. No suicidal ideation currently. Psychotherapy ongoing for 6 months with limited response.'),
('Maria Sanchez', 36, 'Uterine fibroids', 'Uterine fibroid embolization', 'Patient reports heavy menstrual bleeding with anemia (Hgb 9.2). Pelvic ultrasound shows 3 fibroids, largest 6cm intramural. Failed oral contraceptive trial for 4 months. Desires uterine preservation. Meets criteria for minimally invasive treatment.'),
('Nathan Patel', 50, 'Chronic sinusitis', 'Functional endoscopic sinus surgery', 'Patient has recurrent sinusitis with 4 episodes in past 12 months despite maximal medical therapy including nasal steroids, saline irrigation, and 3 courses of antibiotics. CT shows bilateral maxillary and ethmoid sinus disease. SNOT-22 score 48.'),
('Olivia Taylor', 27, 'Endometriosis', 'Diagnostic laparoscopy', 'Patient reports 12 months of cyclic pelvic pain, dysmenorrhea, and dyspareunia. Pelvic exam shows uterosacral nodularity. Failed NSAIDs and combined oral contraceptive trial for 4 months. Transvaginal ultrasound unremarkable but high clinical suspicion for endometriosis.');
