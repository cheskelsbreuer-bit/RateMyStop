// Extra seed stories — diverse across EMT / Fire / DMV / Hospital / Gov't.
// Loaded after static-data.js; merges into the existing officer list so the
// Pulse feed and Stories grid actually contain variety beyond police.
// IDs start at 500000 to avoid collisions with the main seed.

(function () {
  if (!window.STATIC_DATA || !window.STATIC_DATA.officers) return;

  const EXTRAS = [
    // ─── EMT / Paramedics ───
    {
      id: 500001, name: 'EMT M. Hernandez', badge: 'Unit 14', department: 'Rockland Paramedic Services',
      avg_stars: 5, review_count: 2, fair_count: 2, unfair_count: 0,
      reviews: [
        { id: 600001, verdict: 'fair', stars: 5,
          story: "She showed up at 2am after I called for my mom. Calm, fast, asked the right questions. Took my mom's hand and said 'we got you.' Don't know her name — she saved everything.",
          location: 'Spring Valley', tags: ['went-above-and-beyond','late-night-call'],
          author_display: 'Anonymous-4471', upload_url: '#evidence', evidence_type: 'record',
          created_at: '2026-05-10T02:14:00Z' },
        { id: 600002, verdict: 'fair', stars: 5,
          story: "Responded to my dad's stroke in under 7 minutes. Knew exactly what to do. Spoke softly to him the whole way to the hospital. Pure professionalism.",
          location: 'Monsey', tags: ['life-saving'],
          author_display: 'Anonymous-2901',
          created_at: '2026-05-06T19:22:00Z' },
      ],
    },
    {
      id: 500002, name: 'EMT D. Park', badge: 'Unit 7', department: 'Empress EMS',
      avg_stars: 4, review_count: 1, fair_count: 1, unfair_count: 0,
      reviews: [
        { id: 600003, verdict: 'fair', stars: 4,
          story: "Got to my apartment in Yonkers fast. A little rushed but professional. Treated my elderly mother with respect. Asked her questions calmly even when she was scared.",
          location: 'Yonkers', tags: ['professional'],
          author_display: 'Anonymous-5208',
          created_at: '2026-05-08T11:40:00Z' },
      ],
    },
    {
      id: 500003, name: 'Paramedic L. Chen', badge: 'Unit 22', department: 'FDNY EMS Operations',
      avg_stars: 3, review_count: 2, fair_count: 1, unfair_count: 1,
      reviews: [
        { id: 600004, verdict: 'unfair', stars: 2,
          story: "Took 38 minutes to respond. When they got here they were dismissive and made my husband walk to the rig himself. He was in pain. That's not what an EMT should do.",
          location: 'Brooklyn', tags: ['slow','dismissive'],
          author_display: 'Anonymous-7720', upload_url: '#evidence', evidence_type: 'record',
          created_at: '2026-05-04T08:11:00Z' },
        { id: 600005, verdict: 'fair', stars: 4,
          story: "Friend got hurt at a basketball game. Paramedic Chen got him stabilized fast. Calm under pressure.",
          location: 'Bronx', tags: ['calm-under-pressure'],
          author_display: 'Anonymous-1183',
          created_at: '2026-05-09T16:30:00Z' },
      ],
    },
    {
      id: 500004, name: 'EMT R. Thompson', badge: 'Unit 9', department: 'Hudson Valley Ambulance',
      avg_stars: 5, review_count: 1, fair_count: 1, unfair_count: 0,
      reviews: [
        { id: 600006, verdict: 'fair', stars: 5,
          story: "I was having a panic attack on the side of Route 17. He pulled over, didn't rush me, walked me through breathing. Stayed with me until I could drive again. Above and beyond.",
          location: 'Route 17, Suffern', tags: ['above-and-beyond','kind','empathetic'],
          author_display: 'Anonymous-6614',
          created_at: '2026-05-11T14:55:00Z' },
      ],
    },

    // ─── Firefighters ───
    {
      id: 500010, name: 'Capt. P. Murphy', badge: 'Engine 60', department: 'Spring Valley Fire Dept',
      avg_stars: 5, review_count: 2, fair_count: 2, unfair_count: 0,
      reviews: [
        { id: 600010, verdict: 'fair', stars: 5,
          story: "Kitchen fire on Maple Ave. Captain Murphy was first in. After they put it out he sat with my kids on the curb and explained everything to them so they wouldn't be scared. Best of humanity.",
          location: 'Maple Ave, Spring Valley', tags: ['kind','above-and-beyond'],
          author_display: 'Anonymous-3382', upload_url: '#evidence', evidence_type: 'other',
          created_at: '2026-05-09T22:00:00Z' },
        { id: 600011, verdict: 'fair', stars: 5,
          story: "Came to do a smoke-alarm check at our shul. Patient. Answered every question from every member. Real service.",
          location: 'Spring Valley', tags: ['patient','respectful'],
          author_display: 'Anonymous-9011',
          created_at: '2026-05-03T13:00:00Z' },
      ],
    },
    {
      id: 500011, name: 'Firefighter J. Rivera', badge: 'Engine 5', department: 'FDNY — Bureau of Operations',
      avg_stars: 5, review_count: 1, fair_count: 1, unfair_count: 0,
      reviews: [
        { id: 600012, verdict: 'fair', stars: 5,
          story: "We had a small electrical fire in our building lobby. FDNY was here in 4 minutes. Polite, professional, walked us through the building check after.",
          location: 'Manhattan', tags: ['quick','professional'],
          author_display: 'Anonymous-2247',
          created_at: '2026-05-07T18:45:00Z' },
      ],
    },
    {
      id: 500012, name: 'Lt. K. Adler', badge: 'Hose Co. 2', department: 'Yonkers Fire Department',
      avg_stars: 4, review_count: 1, fair_count: 1, unfair_count: 0,
      reviews: [
        { id: 600013, verdict: 'fair', stars: 4,
          story: "Annual home inspection. Honest about what we needed to fix, didn't try to make us feel bad about it. Gave us a printed checklist.",
          location: 'Yonkers', tags: ['professional','clear'],
          author_display: 'Anonymous-6649',
          created_at: '2026-05-02T10:20:00Z' },
      ],
    },

    // ─── DMV ───
    {
      id: 500020, name: 'Ms. C. Ortiz', badge: 'Window 5', department: 'NY DMV — Spring Valley',
      avg_stars: 5, review_count: 2, fair_count: 2, unfair_count: 0,
      reviews: [
        { id: 600020, verdict: 'fair', stars: 5,
          story: "I had wrong paperwork for my title transfer. Instead of sending me home she walked me through what I needed, looked it up on her screen, and handed me a checklist. Saved me a second trip.",
          location: 'Spring Valley DMV', tags: ['helpful','went-above-and-beyond'],
          author_display: 'Anonymous-3334', upload_url: '#evidence', evidence_type: 'receipt',
          created_at: '2026-05-10T11:00:00Z' },
        { id: 600021, verdict: 'fair', stars: 5,
          story: "Renewed my registration. In and out in 12 minutes. She was efficient and kind to my elderly father.",
          location: 'Spring Valley DMV', tags: ['quick','kind'],
          author_display: 'Anonymous-8810',
          created_at: '2026-05-05T09:30:00Z' },
      ],
    },
    {
      id: 500021, name: 'Mr. D. Goldstein', badge: 'Window 3', department: 'NY DMV — Yonkers',
      avg_stars: 2, review_count: 2, fair_count: 0, unfair_count: 2,
      reviews: [
        { id: 600022, verdict: 'unfair', stars: 2,
          story: "Waited 2 hours just to be told my passport photo was 'half a millimeter off' and to come back. No flexibility, no offer to help me reshoot it. Just sent me away.",
          location: 'Yonkers DMV', tags: ['rude','wouldnt-explain'],
          author_display: 'Anonymous-5519',
          created_at: '2026-05-08T15:00:00Z' },
        { id: 600023, verdict: 'unfair', stars: 2,
          story: "Asked me to fill the form twice because he said my handwriting was 'too messy.' Real attitude. Made the whole line wait while he lectured me.",
          location: 'Yonkers DMV', tags: ['rude','power-tripping'],
          author_display: 'Anonymous-2245',
          created_at: '2026-05-06T14:20:00Z' },
      ],
    },
    {
      id: 500022, name: 'Ms. T. Wright', badge: 'Window 12', department: 'NY DMV — Manhattan Herald Sq',
      avg_stars: 4, review_count: 1, fair_count: 1, unfair_count: 0,
      reviews: [
        { id: 600024, verdict: 'fair', stars: 4,
          story: "Honest, fast, no nonsense. Treated me like an adult. Wish all the DMV staff were like her.",
          location: 'Manhattan Herald Sq DMV', tags: ['professional','clear'],
          author_display: 'Anonymous-7723',
          created_at: '2026-05-04T12:00:00Z' },
      ],
    },

    // ─── Hospitals ───
    {
      id: 500030, name: 'Nurse S. Khan', badge: 'RN — ER', department: 'Nyack Hospital',
      avg_stars: 5, review_count: 2, fair_count: 2, unfair_count: 0,
      reviews: [
        { id: 600030, verdict: 'fair', stars: 5,
          story: "ER at 11pm. She stayed with my daughter after a panic attack — held her hand and explained every single thing they were going to do. Stayed past her shift to make sure we were okay.",
          location: 'Nyack Hospital', tags: ['above-and-beyond','empathetic','listened-to-me'],
          author_display: 'Anonymous-1502', upload_url: '#evidence', evidence_type: 'record',
          created_at: '2026-05-11T01:15:00Z' },
        { id: 600031, verdict: 'fair', stars: 5,
          story: "I came in scared and she changed the temperature of the room because I was shaking. Small thing. Meant everything.",
          location: 'Nyack Hospital', tags: ['kind'],
          author_display: 'Anonymous-7281',
          created_at: '2026-05-06T20:00:00Z' },
      ],
    },
    {
      id: 500031, name: 'Dr. A. Foster', badge: 'Floor 3 / IM', department: 'Good Samaritan Hospital',
      avg_stars: 3, review_count: 2, fair_count: 1, unfair_count: 1,
      reviews: [
        { id: 600032, verdict: 'unfair', stars: 2,
          story: "Spent 4 minutes with my father. Didn't make eye contact. Walked out while my mother was still asking a question. We're paying $40k a year for this.",
          location: 'Good Samaritan', tags: ['rushed-me','dismissive'],
          author_display: 'Anonymous-3309',
          created_at: '2026-05-05T16:30:00Z' },
        { id: 600033, verdict: 'fair', stars: 4,
          story: "Took the time to walk me through every option for my mother's surgery. Clear, patient, didn't pressure us.",
          location: 'Good Samaritan', tags: ['clear','patient'],
          author_display: 'Anonymous-9920',
          created_at: '2026-05-09T11:10:00Z' },
      ],
    },
    {
      id: 500032, name: 'Tech R. Ali', badge: 'Phlebotomy', department: 'Westchester Medical Center',
      avg_stars: 5, review_count: 1, fair_count: 1, unfair_count: 0,
      reviews: [
        { id: 600034, verdict: 'fair', stars: 5,
          story: "I'm terrible with needles. He distracted me with a story about his kid's soccer team while drawing 3 vials. I didn't even notice. Real talent — and real kindness.",
          location: 'Westchester Medical', tags: ['kind','empathetic'],
          author_display: 'Anonymous-4127',
          created_at: '2026-05-10T08:50:00Z' },
      ],
    },

    // ─── Government caseworkers ───
    {
      id: 500040, name: 'Caseworker M. Brooks', badge: 'HRA Unit 4', department: 'NYC Human Resources Administration (HRA)',
      avg_stars: 5, review_count: 1, fair_count: 1, unfair_count: 0,
      reviews: [
        { id: 600040, verdict: 'fair', stars: 5,
          story: "I was about to lose my apartment. She personally walked my application through, called the landlord with me, found three programs I qualified for I'd never heard of. She fought for me.",
          location: 'NYC HRA office', tags: ['went-above-and-beyond','helpful'],
          author_display: 'Anonymous-6402', upload_url: '#evidence', evidence_type: 'record',
          created_at: '2026-05-09T14:00:00Z' },
      ],
    },
    {
      id: 500041, name: 'Specialist J. Romero', badge: 'Claims', department: 'NYS Department of Labor — Unemployment',
      avg_stars: 2, review_count: 2, fair_count: 0, unfair_count: 2,
      reviews: [
        { id: 600041, verdict: 'unfair', stars: 2,
          story: "Hung up on me twice. Third call she sighed audibly when I asked for my case number. I've been waiting 9 weeks for my claim.",
          location: 'NYS DOL (phone)', tags: ['rude','dismissive'],
          author_display: 'Anonymous-8835',
          created_at: '2026-05-04T11:45:00Z' },
        { id: 600042, verdict: 'unfair', stars: 1,
          story: "She told me I should 'just get a job' when I called about my claim. That's not her job to say. I have a degree and I'm trying.",
          location: 'NYS DOL', tags: ['rude','power-tripping'],
          author_display: 'Anonymous-7714',
          created_at: '2026-05-07T13:20:00Z' },
      ],
    },
    {
      id: 500042, name: 'Inspector K. Yang', badge: 'Building Insp.', department: 'Rockland County Clerk',
      avg_stars: 4, review_count: 1, fair_count: 1, unfair_count: 0,
      reviews: [
        { id: 600043, verdict: 'fair', stars: 4,
          story: "Came for an addition inspection. Knew the code cold. Pointed out two issues I hadn't seen and didn't make me feel stupid. Signed off the same day.",
          location: 'New City, NY', tags: ['knowledgeable','professional'],
          author_display: 'Anonymous-3344',
          created_at: '2026-05-08T10:00:00Z' },
      ],
    },

    // ─── SCHOOL BOARD (East Ramapo CSD) ───
    {
      id: 500050, name: 'Board Member Y. Weissmandel', role: 'school', department: 'East Ramapo Central School District',
      avg_stars: 3, review_count: 2, fair_count: 1, unfair_count: 1,
      reviews: [
        { id: 600050, verdict: 'fair', stars: 4,
          story: "Showed up to the November board meeting about busing changes. Heard the parents out. Didn't rush. Said he'd follow up — and he did, within the week. Rare.",
          location: 'Spring Valley', tags: ['responsive','transparent'],
          author_display: 'Anonymous-5520',
          created_at: '2026-05-09T20:14:00Z' },
        { id: 600051, verdict: 'unfair', stars: 2,
          story: "Voted yes on the bus contract change without explaining how it affects the special-ed routes. Three parents asked. He said 'we'll review.' That was two months ago.",
          location: 'Spring Valley', tags: ['no-follow-through'],
          author_display: 'Anonymous-8812',
          created_at: '2026-04-22T19:30:00Z' },
      ],
    },
    {
      id: 500051, name: 'Trustee S. Goldberg', role: 'school', department: 'East Ramapo Central School District',
      avg_stars: 4, review_count: 1, fair_count: 1, unfair_count: 0,
      reviews: [
        { id: 600052, verdict: 'fair', stars: 4,
          story: "Sat with us after the meeting for 40 minutes. Took notes. Pushed back politely on a few things — but she actually engaged. Felt heard.",
          location: 'Monsey', tags: ['engaged','listens'],
          author_display: 'Anonymous-6633',
          created_at: '2026-05-05T21:00:00Z' },
      ],
    },
    {
      id: 500052, name: 'Superintendent Dr. M. Rivera', role: 'school', department: 'East Ramapo Central School District',
      avg_stars: 4, review_count: 1, fair_count: 1, unfair_count: 0,
      reviews: [
        { id: 600053, verdict: 'fair', stars: 4,
          story: "Sent a personal email back within 24 hours when I asked about IEP delays. Didn't deflect. Got me a meeting with the team the next week.",
          location: 'Spring Valley', tags: ['responsive','accountable'],
          author_display: 'Anonymous-2204',
          created_at: '2026-05-07T14:18:00Z' },
      ],
    },

    // ─── LOCAL ELECTED (Spring Valley Village + Rockland County) ───
    {
      id: 500060, name: 'Mayor Alan Simon', role: 'elected', department: 'Village of Spring Valley',
      avg_stars: 4, review_count: 2, fair_count: 2, unfair_count: 0,
      reviews: [
        { id: 600060, verdict: 'fair', stars: 4,
          story: "Showed up at the Skylark Drive flooding meeting. Actually walked the block with us. Didn't promise the moon — gave us a 60-day timeline and stuck to it.",
          location: 'Spring Valley', tags: ['accessible','keeps-promises'],
          author_display: 'Anonymous-1098',
          created_at: '2026-05-04T18:00:00Z' },
        { id: 600061, verdict: 'fair', stars: 5,
          story: "Came to my dad's funeral. He didn't know my dad — just heard he'd been a long-time resident. That mattered to my mom more than I can explain.",
          location: 'Spring Valley', tags: ['kind','community-presence'],
          author_display: 'Anonymous-7714',
          created_at: '2026-04-29T16:45:00Z' },
      ],
    },
    {
      id: 500061, name: 'Trustee Asher Grossman', role: 'elected', department: 'Village of Spring Valley',
      avg_stars: 3, review_count: 1, fair_count: 0, unfair_count: 1,
      reviews: [
        { id: 600062, verdict: 'unfair', stars: 2,
          story: "Asked three times at public comment about the recycling pickup change. He cut me off twice and the third time I just gave up. We need our trustees to listen, not just talk.",
          location: 'Spring Valley', tags: ['dismissive'],
          author_display: 'Anonymous-3389',
          created_at: '2026-05-02T19:55:00Z' },
      ],
    },
    {
      id: 500062, name: 'Legislator Aron Wieder', role: 'elected', department: 'Rockland County Legislature, District 13',
      avg_stars: 5, review_count: 1, fair_count: 1, unfair_count: 0,
      reviews: [
        { id: 600063, verdict: 'fair', stars: 5,
          story: "Helped us cut through county red tape on a senior-housing permit. Two phone calls, one email — six months of stalling became a yes. He just does the work.",
          location: 'New Hempstead', tags: ['effective','gets-things-done'],
          author_display: 'Anonymous-5511',
          created_at: '2026-05-06T11:20:00Z' },
      ],
    },
    {
      id: 500063, name: 'Supervisor Michael Specht', role: 'elected', department: 'Town of Ramapo',
      avg_stars: 4, review_count: 1, fair_count: 1, unfair_count: 0,
      reviews: [
        { id: 600064, verdict: 'fair', stars: 4,
          story: "Town hall on the proposed development at Route 59. He stayed past 10pm so every resident got a turn at the mic. Disagreed with some of us politely. Showed respect.",
          location: 'Suffern', tags: ['patient','respectful'],
          author_display: 'Anonymous-9920',
          created_at: '2026-05-08T22:15:00Z' },
      ],
    },

    // ─── STATE / FEDERAL OFFICIALS — fully reviewable ───
    // Every public servant up the pyramid is on the same record. Real seed stories below.
    {
      id: 500070, name: 'Gov. Kathy Hochul', role: 'federal', department: "Governor's Office, New York State",
      avg_stars: 4, review_count: 1, fair_count: 1, unfair_count: 0,
      reviews: [{
        id: 600070, verdict: 'fair', stars: 4,
        story: "Came up to Rockland for the flooding tour after the September storms. Answered actual questions, didn't dodge the FEMA timeline. The follow-through on the disaster declaration was faster than I expected.",
        location: 'Rockland County, NY', tags: ['responsive','followed-through'],
        author_display: 'Anonymous-2901',
        created_at: '2026-05-09T15:00:00Z',
      }],
    },
    {
      id: 500071, name: 'Sen. Chuck Schumer', role: 'federal', department: 'U.S. Senate, New York',
      avg_stars: 3, review_count: 1, fair_count: 0, unfair_count: 1,
      reviews: [{
        id: 600071, verdict: 'unfair', stars: 2,
        story: "Wrote his office three times about the Spring Valley housing situation. Three identical form letters back. No actual response to the specific question I asked about HUD funding.",
        location: 'New York', tags: ['form-letter','no-real-answer'],
        author_display: 'Anonymous-5520',
        created_at: '2026-05-07T14:30:00Z',
      }],
    },
    {
      id: 500072, name: 'Sen. Kirsten Gillibrand', role: 'federal', department: 'U.S. Senate, New York',
      avg_stars: 4, review_count: 1, fair_count: 1, unfair_count: 0,
      reviews: [{
        id: 600072, verdict: 'fair', stars: 4,
        story: "Showed up at the Nyack veterans' event in February. Stayed past the program ended, took questions one-on-one. Office actually called me back about the VA paperwork issue.",
        location: 'Nyack, NY', tags: ['accessible','followed-through'],
        author_display: 'Anonymous-9088',
        created_at: '2026-05-04T20:15:00Z',
      }],
    },
    {
      id: 500073, name: 'Rep. Mike Lawler', role: 'federal', department: 'U.S. Congress, NY-17',
      avg_stars: 3, review_count: 2, fair_count: 1, unfair_count: 1,
      reviews: [{
        id: 600073, verdict: 'fair', stars: 4,
        story: "Town hall in Pearl River. Answered every question, including the hostile ones. Disagreed with me on the spending bill but explained his reasoning. That's the minimum and most reps don't do it.",
        location: 'Pearl River, NY', tags: ['accessible','transparent'],
        author_display: 'Anonymous-2317',
        created_at: '2026-05-06T19:00:00Z',
      }, {
        id: 600074, verdict: 'unfair', stars: 2,
        story: "His office never followed up on the constituent services request I submitted in March. Two months. Still nothing.",
        location: 'NY-17', tags: ['no-follow-through'],
        author_display: 'Anonymous-7714',
        created_at: '2026-05-02T11:00:00Z',
      }],
    },
    {
      id: 500074, name: 'The President', role: 'federal', department: 'The White House',
      avg_stars: 0, review_count: 0, fair_count: 0, unfair_count: 0, reviews: [],
    },
    // ─── ADDITIONAL STATE OFFICIALS ───
    {
      id: 500075, name: 'Sen. James Skoufis', role: 'federal', department: 'NY State Senate, District 42',
      avg_stars: 5, review_count: 1, fair_count: 1, unfair_count: 0,
      reviews: [{
        id: 600075, verdict: 'fair', stars: 5,
        story: "Pushed our concern about the Route 17 closure all the way to the DOT commissioner. Got us a real timeline. Calls his constituents back personally — old-school.",
        location: 'NYS District 42', tags: ['effective','accessible'],
        author_display: 'Anonymous-4499',
        created_at: '2026-05-08T17:20:00Z',
      }],
    },
    {
      id: 500076, name: 'AG Letitia James', role: 'federal', department: 'NY State Attorney General',
      avg_stars: 4, review_count: 1, fair_count: 1, unfair_count: 0,
      reviews: [{
        id: 600076, verdict: 'fair', stars: 4,
        story: "Her office actually responded to a consumer-fraud complaint I filed last year. Took 3 months but ended with a settlement against the company. Most state AGs ignore individual filings.",
        location: 'New York', tags: ['effective'],
        author_display: 'Anonymous-1184',
        created_at: '2026-04-28T13:45:00Z',
      }],
    },
  ];

  // Append to STATIC_DATA so existing renderers pick them up
  window.STATIC_DATA.officers = window.STATIC_DATA.officers.concat(EXTRAS);
  // Update stats summary so they count
  if (window.STATIC_DATA.stats) {
    const extraReviews = EXTRAS.reduce((s, o) => s + (o.review_count || 0), 0);
    window.STATIC_DATA.stats.total_reviews = (window.STATIC_DATA.stats.total_reviews || 0) + extraReviews;
    window.STATIC_DATA.stats.officer_count = (window.STATIC_DATA.stats.officer_count || 0) + EXTRAS.length;
  }
})();
