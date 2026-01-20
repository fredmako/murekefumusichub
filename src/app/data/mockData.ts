import { Composition, Purchase, User } from '@/app/App';

export const mockCompositions: Composition[] = [
  {
    id: '1',
    title: 'Ave Maria',
    composerId: '2',
    composerName: 'Sarah Johnson',
    price: 29.99,
    description: 'A beautiful setting of the traditional Ave Maria for SATB choir with piano accompaniment.',
    voiceParts: ['Soprano', 'Alto', 'Tenor', 'Bass'],
    difficulty: 'Intermediate',
    duration: '4:30',
    language: 'Latin',
    accompaniment: 'Piano',
    dateAdded: '2026-01-15'
  },
  {
    id: '2',
    title: 'Lux Aeterna',
    composerId: '3',
    composerName: 'Michael Chen',
    price: 34.99,
    description: 'An ethereal choral work exploring themes of eternal light. Perfect for concert performances.',
    voiceParts: ['Soprano', 'Alto', 'Tenor', 'Bass'],
    difficulty: 'Advanced',
    duration: '6:15',
    language: 'Latin',
    accompaniment: 'A cappella',
    dateAdded: '2026-01-10'
  },
  {
    id: '3',
    title: 'Morning Has Broken',
    composerId: '2',
    composerName: 'Sarah Johnson',
    price: 24.99,
    description: 'A joyful arrangement of this beloved hymn for three-part choir.',
    voiceParts: ['Soprano', 'Alto', 'Bass'],
    difficulty: 'Easy',
    duration: '3:45',
    language: 'English',
    accompaniment: 'Organ',
    dateAdded: '2026-01-12'
  },
  {
    id: '4',
    title: 'O Magnum Mysterium',
    composerId: '4',
    composerName: 'Emily Rodriguez',
    price: 39.99,
    description: 'A contemporary take on this Christmas classic with rich harmonies and dynamic contrasts.',
    voiceParts: ['Soprano I', 'Soprano II', 'Alto', 'Tenor', 'Bass'],
    difficulty: 'Advanced',
    duration: '5:20',
    language: 'Latin',
    accompaniment: 'A cappella',
    dateAdded: '2026-01-08'
  },
  {
    id: '5',
    title: 'Sing We Now of Christmas',
    composerId: '3',
    composerName: 'Michael Chen',
    price: 19.99,
    description: 'A festive arrangement perfect for community choirs and church groups.',
    voiceParts: ['Soprano', 'Alto', 'Tenor', 'Bass'],
    difficulty: 'Easy',
    duration: '3:00',
    language: 'English',
    accompaniment: 'Piano',
    dateAdded: '2026-01-14'
  },
  {
    id: '6',
    title: 'The River Sings',
    composerId: '4',
    composerName: 'Emily Rodriguez',
    price: 44.99,
    description: 'An original composition inspired by nature, featuring flowing melodic lines and water imagery.',
    voiceParts: ['Soprano', 'Alto', 'Tenor', 'Bass'],
    difficulty: 'Intermediate',
    duration: '7:10',
    language: 'English',
    accompaniment: 'String Quartet',
    dateAdded: '2026-01-05'
  }
];

export const mockUsers: User[] = [
  { id: '1', name: 'John Doe', email: 'john@example.com', role: 'buyer' },
  { id: '2', name: 'Sarah Johnson', email: 'sarah@example.com', role: 'composer' },
  { id: '3', name: 'Michael Chen', email: 'michael@example.com', role: 'composer' },
  { id: '4', name: 'Emily Rodriguez', email: 'emily@example.com', role: 'composer' },
  { id: '5', name: 'Admin User', email: 'admin@example.com', role: 'admin' },
  { id: '6', name: 'Jane Smith', email: 'jane@example.com', role: 'buyer' },
  { id: '7', name: 'Robert Wilson', email: 'robert@example.com', role: 'buyer' }
];

export const mockPurchases: Purchase[] = [
  {
    id: 'p1',
    compositionId: '1',
    buyerId: '1',
    purchaseDate: '2026-01-16',
    price: 29.99
  },
  {
    id: 'p2',
    compositionId: '3',
    buyerId: '1',
    purchaseDate: '2026-01-17',
    price: 24.99
  },
  {
    id: 'p3',
    compositionId: '2',
    buyerId: '6',
    purchaseDate: '2026-01-15',
    price: 34.99
  },
  {
    id: 'p4',
    compositionId: '4',
    buyerId: '6',
    purchaseDate: '2026-01-14',
    price: 39.99
  },
  {
    id: 'p5',
    compositionId: '5',
    buyerId: '7',
    purchaseDate: '2026-01-18',
    price: 19.99
  }
];
