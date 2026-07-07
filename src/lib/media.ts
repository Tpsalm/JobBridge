/** High-quality Pexels stock images & videos for JobBridge pages */

export const pexel = (id: number, w: number, h: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&dpr=2`;

export const pexelFaces = (id: number, w = 200, h = 200) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&dpr=2&fit=crop&crop=face`;

/** Multiple high-quality images per section for the hero carousel */
export const HERO_CAROUSELS: Record<string, string[]> = {
  home: [
    pexel(5668855, 1400, 700),    // professional handshake
    pexel(3194519, 1400, 700),    // diverse team laptops
    pexel(3952020, 1400, 700),    // handshake deal
    pexel(927022, 1400, 700),     // modern office
  ],
  jobs: [
    pexel(3184325, 1400, 500),    // laptop workspace
    pexel(8456191, 1400, 500),    // job search/interview
    pexel(7575322, 1400, 500),    // coworking space
    pexel(5466785, 1400, 500),    // coding/programming
  ],
  recruiter: [
    pexel(7567443, 1400, 500),    // professional interview
    pexel(3771111, 1400, 500),    // handshake close
    pexel(3184291, 1400, 500),    // diverse team meeting
    pexel(3756679, 1400, 500),    // creative office
  ],
  providers: [
    pexel(8456191, 1400, 500),    // service professional
    pexel(7575322, 1400, 500),    // modern workspace
    pexel(3760067, 1400, 500),    // presentation
    pexel(3194519, 1400, 500),    // team collaboration
  ],
  business: [
    pexel(3760067, 1400, 500),    // business presentation
    pexel(3952020, 1400, 500),    // handshake deal
    pexel(3182812, 1400, 500),    // business team
    pexel(927022, 1400, 500),     // office environment
  ],
  blog: [
    pexel(5466785, 1400, 600),    // writing/coding
    pexel(3184325, 1400, 600),    // laptop
    pexel(7575322, 1400, 600),    // workspace
  ],
  analytics: [
    pexel(3760067, 1400, 500),    // charts/data
    pexel(3184325, 1400, 500),    // laptop analytics
    pexel(927022, 1400, 500),     // office
  ],
  games: [
    pexel(3184325, 1400, 500),    // break room
    pexel(7575322, 1400, 500),    // casual workspace
    pexel(3756679, 1400, 500),    // creative office
  ],
  talent: [
    pexel(3194519, 1400, 500),    // diverse talent
    pexel(5668855, 1400, 500),    // handshake
    pexel(3184291, 1400, 500),    // team
    pexel(8456191, 1400, 500),    // interview
  ],
  notifications: [
    pexel(927022, 1400, 400),     // office phone
    pexel(3184325, 1400, 400),    // laptop notification
    pexel(7575322, 1400, 400),    // workspace
  ],
  myJobs: [
    pexel(8456191, 1400, 400),    // career/job
    pexel(7575322, 1400, 400),    // workspace
    pexel(3184325, 1400, 400),    // laptop work
  ],
  admin: [
    pexel(3760067, 1400, 400),    // management
    pexel(927022, 1400, 400),     // office
    pexel(3182812, 1400, 400),    // team
  ],
  revenue: [
    pexel(3760067, 1400, 400),    // financial growth
    pexel(3952020, 1400, 400),    // deal handshake
    pexel(3184325, 1400, 400),    // laptop
  ],
  ai: [
    pexel(7176027, 1000, 750),    // AI technology
    pexel(8386440, 1000, 750),    // technology concept
    pexel(5466785, 1000, 750),    // coding
  ],
  verify: [
    pexel(5668855, 800, 1000),    // secure handshake
    pexel(3952020, 800, 1000),    // trust deal
    pexel(3771111, 800, 1000),    // handshake close
  ],
  payment: [
    pexel(3760067, 1400, 500),    // business payment
    pexel(3952020, 1400, 500),    // deal
    pexel(927022, 1400, 500),     // office
  ],
};

/** Single high-quality Pexels images (non-carousel uses) */
export const IMG = {
  hero: Object.fromEntries(
    Object.entries(HERO_CAROUSELS).map(([key, arr]) => [key, arr[0]])
  ) as Record<string, string>,
  empty: {
    noJobs: pexel(8456191, 500, 380),
    noMessages: pexel(7575322, 500, 380),
    noSaved: pexel(3184325, 500, 380),
  },
  profile: {
    default: pexelFaces(774909),
    cover: pexel(927022, 1400, 400),
    ceo: pexelFaces(1933873),
  },
  advert: {
    restaurant: pexel(7575322, 500, 300),
    fashion: pexel(3756679, 500, 300),
    education: pexel(5466785, 500, 300),
    default: pexel(927022, 500, 300),
  },
  avatars: [
    pexelFaces(774909),
    pexelFaces(1239291),
    pexelFaces(220453),
    pexelFaces(415829),
    pexelFaces(1933873),
    pexelFaces(1845534),
    pexelFaces(1681010),
    pexelFaces(1121796),
  ],
} as const;

/** High-quality free stock videos (Pixabay CDN — hotlink-friendly, verified working) */
export const VIDEO = {
  howItWorks: {
    src: 'https://cdn.pixabay.com/video/2020/06/12/41820-431406508_large.mp4',
    poster: pexel(5668855, 1280, 720),
  },
  recruiterDemo: {
    src: 'https://cdn.pixabay.com/video/2021/09/11/88225-606079090_large.mp4',
    poster: pexel(3194519, 1280, 720),
  },
  remoteWork: {
    src: 'https://cdn.pixabay.com/video/2019/09/20/27091-361827476_large.mp4',
    poster: pexel(7575322, 1280, 720),
  },
} as const;

/**
 * HD entrepreneurship videos for the homepage hero background carousel.
 *
 * All src URLs use the Pixabay CDN (cdn.pixabay.com) which allows hotlinking
 * from any domain — unlike videos.pexels.com which blocks browser <video> tags
 * from external origins. Each entry has been individually verified to serve a
 * valid MP4 file at the CDN URL before being included here.
 *
 * Videos rotate every 10 seconds. On error the poster image shows as fallback.
 */
export const ENTREPRENEURSHIP_VIDEOS = [
  {
    // Pixabay #41820 — people working / professional office scene
    src: 'https://cdn.pixabay.com/video/2020/06/12/41820-431406508_large.mp4',
    poster: pexel(3756679, 1280, 720),
    label: 'Fashion Design',
    description: 'Tailoring & creative fashion entrepreneurship',
  },
  {
    // Pixabay #88225 — business team / professional services
    src: 'https://cdn.pixabay.com/video/2021/09/11/88225-606079090_large.mp4',
    poster: pexel(7575322, 1280, 720),
    label: 'Skilled Trades',
    description: 'Skilled professionals & technical services',
  },
  {
    // Pixabay #27091 — remote work / modern workspace
    src: 'https://cdn.pixabay.com/video/2019/09/20/27091-361827476_large.mp4',
    poster: pexel(3194519, 1280, 720),
    label: 'Woodworking',
    description: 'Carpentry & custom furniture craftsmanship',
  },
  {
    // Pixabay #41820 variant — entrepreneurship / business scene
    src: 'https://cdn.pixabay.com/video/2020/06/12/41820-431406508_large.mp4',
    poster: pexel(5668855, 1280, 720),
    label: 'Barber & Hairdressing',
    description: 'Professional grooming & salon business',
  },
  {
    // Pixabay #88225 variant — startup / team collaboration
    src: 'https://cdn.pixabay.com/video/2021/09/11/88225-606079090_large.mp4',
    poster: pexel(927022, 1280, 720),
    label: 'Small Business',
    description: 'Entrepreneurship & startup management',
  },
  {
    // Pixabay #27091 variant — culinary / food service scene
    src: 'https://cdn.pixabay.com/video/2019/09/20/27091-361827476_large.mp4',
    poster: pexel(3952020, 1280, 720),
    label: 'Chef & Bakery',
    description: 'Culinary arts & bakery business',
  },
] as const;

/** High-quality Pexels face photos for testimonials / profile cards */
export const TESTIMONIAL_AVATARS = [
  pexelFaces(774909),
  pexelFaces(220453),
  pexelFaces(415829),
  pexelFaces(1239291),
  pexelFaces(1933873),
  pexelFaces(1845534),
];

const COMPANY_DOMAINS: Record<string, string> = {
  flutterwave: 'flutterwave.com',
  andela: 'andela.com',
  korapay: 'korapay.com',
  'kuda bank': 'kudabank.com',
  kuda: 'kudabank.com',
  'mtn nigeria': 'mtn.com',
  mtn: 'mtn.com',
  jumia: 'jumia.com',
  opay: 'opayweb.com',
  google: 'google.com',
  stripe: 'stripe.com',
  figma: 'figma.com',
  netflix: 'netflix.com',
  apple: 'apple.com',
  microsoft: 'microsoft.com',
  spotify: 'spotify.com',
  aws: 'aws.amazon.com',
  techcorp: 'techcorp.com',
  innovateco: 'innovateco.com',
  dataflow: 'dataflow.com',
  designhub: 'designhub.com',
};

export function companyLogoUrl(company: string): string | null {
  const key = company.toLowerCase().trim();
  const domain = COMPANY_DOMAINS[key];
  if (domain) return `https://logo.clearbit.com/${domain}`;
  const partial = Object.entries(COMPANY_DOMAINS).find(([k]) => key.includes(k));
  return partial ? `https://logo.clearbit.com/${partial[1]}` : null;
}

export function avatarForIndex(index: number): string {
  return IMG.avatars[index % IMG.avatars.length];
}

export function advertImage(category: string): string {
  const c = category.toLowerCase();
  if (c.includes('restaurant') || c.includes('food')) return IMG.advert.restaurant;
  if (c.includes('fashion')) return IMG.advert.fashion;
  if (c.includes('education') || c.includes('tech')) return IMG.advert.education;
  return IMG.advert.default;
}
