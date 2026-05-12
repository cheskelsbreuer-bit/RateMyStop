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
