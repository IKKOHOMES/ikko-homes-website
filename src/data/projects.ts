import type { Project } from '../types/catalog';

export const projects: Project[] = [
  {
    id: 'bondi', slug: 'bondi-residence', name: 'Bondi Residence', location: 'Sydney, NSW', style: 'Japandi', imageTone: 'bondi',
    introduction: 'A calm Bondi home shaped around soft daylight, tactile finishes and the rituals of everyday living. Natural timber, warm stone and low, sculptural furniture create an easy sense of retreat.',
    designFocus: 'Layered joinery gives each room a quiet function, balancing considered storage with open, light-filled moments.',
    galleryTones: ['bondi-living', 'bondi-kitchen'],
  },
  {
    id: 'coastal', slug: 'coastal-house', name: 'Coastal House', location: 'Byron Bay, NSW', style: 'Organic Modern', imageTone: 'coastal',
    introduction: 'Designed for a slower coastal rhythm, this Byron Bay home brings sculptural forms and sun-washed materials together. The palette stays grounded, relaxed and closely connected to the landscape.',
    designFocus: 'Curved profiles, generous textures and integrated cabinetry give the home warmth without visual noise.',
    galleryTones: ['coastal-lounge', 'coastal-dining'],
  },
  {
    id: 'elwood', slug: 'elwood-apartment', name: 'Elwood Apartment', location: 'Melbourne, VIC', style: 'Quiet Modern', imageTone: 'elwood',
    introduction: 'A compact Elwood apartment reimagined as a composed urban sanctuary. Refined finishes and disciplined proportions make each space feel open, useful and quietly personal.',
    designFocus: 'A restrained material palette creates continuity from the entry through to the living spaces and private rooms.',
    galleryTones: ['elwood-living', 'elwood-bedroom'],
  },
  {
    id: 'paddington', slug: 'paddington-terrace', name: 'Paddington Terrace', location: 'Brisbane, QLD', style: 'Warm Minimalism', imageTone: 'paddington',
    introduction: 'This heritage terrace pairs enduring character with a lighter, contemporary way of living. Sunlit spaces, warm joinery and measured details make a thoughtful home for connection.',
    designFocus: 'The interior moves between heritage texture and modern simplicity, anchored by a confident, warm material story.',
    galleryTones: ['paddington-kitchen', 'paddington-stair'],
  },
];

export function getProjectBySlug(slug: string) {
  return projects.find((project) => project.slug === slug);
}
