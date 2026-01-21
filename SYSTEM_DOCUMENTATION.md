# Prime Media - System Flow & Query Design Documentation

**Platform:** Choral Music Marketplace  
**Version:** 1.0  
**Last Updated:** January 21, 2026

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [User Roles & Permissions](#user-roles--permissions)
4. [System Flow Diagrams](#system-flow-diagrams)
5. [Database Schema Design](#database-schema-design)
6. [Query Designs](#query-designs)
7. [API Endpoints](#api-endpoints)
8. [Firebase Integration](#firebase-integration)
9. [Security & Authentication](#security--authentication)
10. [Transaction Flow](#transaction-flow)

---

## System Overview

Prime Media is a comprehensive choral music marketplace platform that connects composers with buyers (choir directors, music educators, performers). The platform facilitates the buying and selling of digital choral compositions with complete admin oversight.

### Key Features
- **Multi-role Authentication** (Buyer, Composer, Admin)
- **Composition Management** (Upload, Browse, Search, Filter)
- **Shopping Cart & Checkout**
- **Transaction Tracking**
- **File Storage** (PDF scores via Firebase Storage)
- **Role-based Dashboards**
- **Admin Panel** for platform management

---

## Architecture

### Technology Stack

#### Frontend
- **Framework:** React 18+ with TypeScript
- **Styling:** Tailwind CSS v4
- **UI Components:** shadcn/ui components
- **State Management:** React Hooks (useState)
- **Routing:** Client-side navigation via state
- **Notifications:** Sonner toast library

#### Backend Services
- **Authentication:** Firebase Authentication
- **File Storage:** Firebase Cloud Storage
- **Database:** Currently mock data (ready for Firebase Firestore or Supabase)

### Component Architecture

```
/src
├── /app
│   ├── App.tsx                    # Main application component
│   └── /components
│       ├── Login.tsx              # Authentication component
│       ├── Navbar.tsx             # Navigation with cart
│       ├── Marketplace.tsx        # Browse & search compositions
│       ├── ComposerDashboard.tsx  # Composer management interface
│       ├── BuyerDashboard.tsx     # Purchase history & cart
│       ├── AdminPanel.tsx         # Platform administration
│       ├── CompositionCard.tsx    # Composition display card
│       └── UploadComposition.tsx  # Upload form with Firebase
├── /lib
│   └── firebase.ts                # Firebase configuration
└── /app/data
    └── mockData.ts                # Mock data (staging)
```

---

## User Roles & Permissions

### 1. Buyer
**Capabilities:**
- Browse marketplace
- Search and filter compositions
- Add items to cart
- Purchase compositions
- View purchase history
- Download purchased PDFs

**Default View:** Marketplace

### 2. Composer
**Capabilities:**
- All Buyer capabilities
- Upload new compositions
- Manage own compositions
- View sales analytics
- Track earnings
- Edit composition details

**Default View:** Composer Dashboard

### 3. Admin
**Capabilities:**
- View all platform statistics
- Manage all users (view, suspend)
- Manage all compositions (approve, remove)
- View all transactions
- Access analytics dashboard
- Monitor platform health

**Default View:** Admin Panel

---

## System Flow Diagrams

### 1. User Authentication Flow

```
┌─────────────────┐
│  Landing Page   │
│  (Login Screen) │
└────────┬────────┘
         │
         ├─── User enters email/password
         ├─── Selects role (Buyer/Composer/Admin)
         │
         ▼
┌─────────────────────────┐
│  Firebase Auth Check    │
├─────────────────────────┤
│ 1. signInWithEmail...() │
│ 2. If fails, try create │
└────────┬────────────────┘
         │
    ┌────┴────┐
    │ Success │
    └────┬────┘
         │
         ▼
┌──────────────────────┐
│  Role-based Redirect │
├──────────────────────┤
│ Buyer → Marketplace  │
│ Composer → Dashboard │
│ Admin → Admin Panel  │
└──────────────────────┘
```

### 2. Composition Upload Flow (Composer)

```
┌─────────────────────┐
│ Composer Dashboard  │
│ Click "Upload New"  │
└──────────┬──────────┘
           │
           ▼
┌───────────────────────────┐
│  Upload Form              │
├───────────────────────────┤
│ - Title                   │
│ - Description             │
│ - Price                   │
│ - Voice Parts (checkboxes)│
│ - Difficulty (select)     │
│ - Duration                │
│ - Language (select)       │
│ - Accompaniment (select)  │
│ - PDF File Upload         │
└───────────┬───────────────┘
            │
            │ Submit
            ▼
┌────────────────────────────┐
│  Firebase Storage Upload   │
├────────────────────────────┤
│ 1. Create storage ref      │
│ 2. uploadBytesResumable()  │
│ 3. Show progress bar       │
│ 4. Get download URL        │
└────────────┬───────────────┘
             │
             ▼
┌─────────────────────────────┐
│  Save to Database           │
├─────────────────────────────┤
│ compositionData + pdfUrl    │
└─────────────┬───────────────┘
              │
              ▼
┌──────────────────────────┐
│  Success Notification    │
│  Return to Dashboard     │
└──────────────────────────┘
```

### 3. Purchase Flow (Buyer)

```
┌─────────────────┐
│  Marketplace    │
│  Browse Items   │
└────────┬────────┘
         │
         ├─── Search/Filter
         ├─── View Details
         │
         ▼
┌────────────────────┐
│  Add to Cart       │
└────────┬───────────┘
         │
         │ (Multiple items)
         ▼
┌────────────────────┐
│  View Cart         │
│  (Navbar dropdown) │
└────────┬───────────┘
         │
         │ Click "Checkout"
         ▼
┌─────────────────────────┐
│  Buyer Dashboard        │
│  Review Cart            │
└────────┬────────────────┘
         │
         │ Confirm Purchase
         ▼
┌──────────────────────────┐
│  Process Transaction     │
├──────────────────────────┤
│ 1. Create purchase record│
│ 2. Update composer sales │
│ 3. Grant access to PDF   │
│ 4. Clear cart            │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│  Purchase Complete       │
│  Download Available      │
└──────────────────────────┘
```

### 4. Admin Monitoring Flow

```
┌─────────────────────┐
│  Admin Login        │
└──────────┬──────────┘
           │
           ▼
┌────────────────────────────┐
│  Admin Dashboard           │
├────────────────────────────┤
│ ┌────────────────────────┐ │
│ │  Overview Tab          │ │
│ │  - Stats Cards         │ │
│ │  - Top Composers       │ │
│ │  - Recent Transactions │ │
│ └────────────────────────┘ │
│                            │
│ ┌────────────────────────┐ │
│ │  Users Tab             │ │
│ │  - All users list      │ │
│ │  - Suspend/View        │ │
│ └────────────────────────┘ │
│                            │
│ ┌────────────────────────┐ │
│ │  Compositions Tab      │ │
│ │  - All compositions    │ │
│ │  - Approve/Remove      │ │
│ └────────────────────────┘ │
│                            │
│ ┌────────────────────────┐ │
│ │  Transactions Tab      │ │
│ │  - Complete history    │ │
│ │  - Export data         │ │
│ └────────────────────────┘ │
└────────────────────────────┘
```

---

## Database Schema Design

### Recommended Database: Firebase Firestore or Supabase

### Collections/Tables

#### 1. **users**
```typescript
{
  id: string;              // Auto-generated UID
  email: string;           // Unique, indexed
  name: string;
  role: 'buyer' | 'composer' | 'admin';
  createdAt: timestamp;
  updatedAt: timestamp;
  status: 'active' | 'suspended';
  
  // Composer-specific fields (optional)
  composerProfile?: {
    bio: string;
    website: string;
    socialLinks: {
      twitter?: string;
      instagram?: string;
    }
  };
  
  // Buyer-specific fields (optional)
  buyerProfile?: {
    organization: string;
    choirType: string;
  };
}
```

**Indexes:**
- `email` (unique)
- `role`
- `status`
- `createdAt` (desc)

---

#### 2. **compositions**
```typescript
{
  id: string;                    // Auto-generated
  title: string;                 // Indexed for search
  composerId: string;            // FK to users.id
  composerName: string;          // Denormalized for performance
  price: number;                 // Decimal(10,2)
  description: string;           // Full text indexed
  voiceParts: string[];          // Array: ['Soprano', 'Alto', ...]
  difficulty: 'Easy' | 'Intermediate' | 'Advanced';
  duration: string;              // Format: "mm:ss"
  language: string;              // 'English', 'Latin', etc.
  accompaniment: string;         // 'A cappella', 'Piano', etc.
  pdfUrl: string;                // Firebase Storage URL
  
  // Metadata
  dateAdded: timestamp;
  updatedAt: timestamp;
  status: 'active' | 'pending' | 'removed';
  
  // Analytics
  viewCount: number;
  purchaseCount: number;
  
  // Tags for searchability
  tags: string[];                // Array of keywords
}
```

**Indexes:**
- `composerId`
- `title` (full-text)
- `difficulty`
- `language`
- `accompaniment`
- `status`
- `dateAdded` (desc)
- `price` (asc/desc)
- Composite: `(status, dateAdded desc)`

---

#### 3. **purchases**
```typescript
{
  id: string;                    // Auto-generated
  compositionId: string;         // FK to compositions.id
  buyerId: string;               // FK to users.id
  price: number;                 // Snapshot of price at purchase
  purchaseDate: timestamp;
  
  // Transaction details
  transactionId: string;         // Payment gateway ID
  paymentMethod: 'credit_card' | 'paypal' | 'stripe';
  status: 'completed' | 'pending' | 'refunded';
  
  // Denormalized for reporting (avoid joins)
  compositionTitle: string;
  composerName: string;
  buyerName: string;
  buyerEmail: string;
}
```

**Indexes:**
- `buyerId`
- `compositionId`
- `purchaseDate` (desc)
- `status`
- Composite: `(buyerId, purchaseDate desc)`
- Composite: `(compositionId, purchaseDate desc)`

---

#### 4. **cart_items** (Optional - can be client-side only)
```typescript
{
  id: string;
  userId: string;               // FK to users.id
  compositionId: string;        // FK to compositions.id
  quantity: number;             // Usually 1 for digital goods
  addedAt: timestamp;
}
```

**Indexes:**
- `userId`
- Composite: `(userId, compositionId)` (unique)

---

#### 5. **reviews** (Future feature)
```typescript
{
  id: string;
  compositionId: string;
  buyerId: string;
  rating: number;               // 1-5
  comment: string;
  createdAt: timestamp;
  status: 'published' | 'flagged' | 'removed';
}
```

---

## Query Designs

### Common Queries

#### 1. **Marketplace - Browse All Compositions**
```typescript
// Firestore
const q = query(
  collection(db, 'compositions'),
  where('status', '==', 'active'),
  orderBy('dateAdded', 'desc'),
  limit(50)
);

// Supabase
const { data } = await supabase
  .from('compositions')
  .select('*')
  .eq('status', 'active')
  .order('dateAdded', { ascending: false })
  .limit(50);
```

---

#### 2. **Marketplace - Search & Filter**
```typescript
// Multiple filters
const q = query(
  collection(db, 'compositions'),
  where('status', '==', 'active'),
  where('difficulty', '==', 'Intermediate'),
  where('language', '==', 'Latin'),
  where('accompaniment', '==', 'A cappella')
);

// With search (requires full-text search index)
// For Firestore, use Algolia or Typesense
// For Supabase, use built-in full-text search:
const { data } = await supabase
  .from('compositions')
  .select('*')
  .eq('status', 'active')
  .textSearch('title', searchTerm)
  .eq('difficulty', difficulty)
  .eq('language', language);
```

---

#### 3. **Composer Dashboard - Get My Compositions**
```typescript
const q = query(
  collection(db, 'compositions'),
  where('composerId', '==', currentUserId),
  orderBy('dateAdded', 'desc')
);

// With sales count (requires join or aggregation)
const compositionsWithSales = await Promise.all(
  compositions.map(async (comp) => {
    const salesQuery = query(
      collection(db, 'purchases'),
      where('compositionId', '==', comp.id)
    );
    const salesSnapshot = await getDocs(salesQuery);
    return {
      ...comp,
      salesCount: salesSnapshot.size,
      totalRevenue: salesSnapshot.docs.reduce(
        (sum, doc) => sum + doc.data().price,
        0
      )
    };
  })
);
```

---

#### 4. **Buyer Dashboard - Get My Purchases**
```typescript
const q = query(
  collection(db, 'purchases'),
  where('buyerId', '==', currentUserId),
  orderBy('purchaseDate', 'desc')
);

// With composition details (denormalized data)
const purchases = await getDocs(q);
// Composition data already in purchase record
```

---

#### 5. **Admin Panel - Platform Statistics**
```typescript
// Total users count
const usersSnapshot = await getDocs(collection(db, 'users'));
const totalUsers = usersSnapshot.size;

// Total compositions
const compsSnapshot = await getDocs(
  query(collection(db, 'compositions'), where('status', '==', 'active'))
);
const totalCompositions = compsSnapshot.size;

// Total revenue
const purchasesSnapshot = await getDocs(collection(db, 'purchases'));
const totalRevenue = purchasesSnapshot.docs.reduce(
  (sum, doc) => sum + doc.data().price,
  0
);

// Recent transactions
const recentTransactions = query(
  collection(db, 'purchases'),
  orderBy('purchaseDate', 'desc'),
  limit(10)
);
```

---

#### 6. **Admin Panel - Top Composers**
```typescript
// Aggregate query (Firestore requires client-side aggregation or Cloud Functions)
const composers = await getDocs(
  query(collection(db, 'users'), where('role', '==', 'composer'))
);

const composerStats = await Promise.all(
  composers.docs.map(async (composerDoc) => {
    const composer = composerDoc.data();
    
    // Get compositions count
    const compsQuery = query(
      collection(db, 'compositions'),
      where('composerId', '==', composerDoc.id)
    );
    const compsSnapshot = await getDocs(compsQuery);
    
    // Get sales
    const compositionIds = compsSnapshot.docs.map(doc => doc.id);
    const salesQuery = query(
      collection(db, 'purchases'),
      where('compositionId', 'in', compositionIds)
    );
    const salesSnapshot = await getDocs(salesQuery);
    
    const revenue = salesSnapshot.docs.reduce(
      (sum, doc) => sum + doc.data().price,
      0
    );
    
    return {
      ...composer,
      id: composerDoc.id,
      compositionCount: compsSnapshot.size,
      salesCount: salesSnapshot.size,
      revenue
    };
  })
);

// Sort by revenue
composerStats.sort((a, b) => b.revenue - a.revenue);
```

---

#### 7. **User Purchase History with Downloadable PDFs**
```typescript
const purchasesQuery = query(
  collection(db, 'purchases'),
  where('buyerId', '==', currentUserId),
  where('status', '==', 'completed')
);

const purchases = await getDocs(purchasesQuery);

// Get composition details to access pdfUrl
const purchasesWithPDF = await Promise.all(
  purchases.docs.map(async (purchaseDoc) => {
    const purchase = purchaseDoc.data();
    const compositionDoc = await getDoc(
      doc(db, 'compositions', purchase.compositionId)
    );
    return {
      ...purchase,
      pdfUrl: compositionDoc.data()?.pdfUrl,
      composition: compositionDoc.data()
    };
  })
);
```

---

## API Endpoints

### Recommended REST API Structure (if using backend server)

#### Authentication
```
POST   /api/auth/register          # Create new user
POST   /api/auth/login             # Login user
POST   /api/auth/logout            # Logout user
GET    /api/auth/me                # Get current user
```

#### Compositions
```
GET    /api/compositions           # List all (with filters)
GET    /api/compositions/:id       # Get single composition
POST   /api/compositions           # Create (composers only)
PUT    /api/compositions/:id       # Update (owner/admin only)
DELETE /api/compositions/:id       # Delete (owner/admin only)
GET    /api/compositions/:id/pdf   # Download PDF (if purchased)
```

#### Purchases
```
GET    /api/purchases              # Get my purchases
POST   /api/purchases              # Create purchase
GET    /api/purchases/:id          # Get purchase details
```

#### Users (Admin only)
```
GET    /api/users                  # List all users
GET    /api/users/:id              # Get user details
PUT    /api/users/:id              # Update user
DELETE /api/users/:id              # Suspend user
```

#### Analytics (Composer/Admin)
```
GET    /api/analytics/sales        # Sales statistics
GET    /api/analytics/revenue      # Revenue by period
GET    /api/analytics/top-items    # Best selling compositions
```

---

## Firebase Integration

### Current Implementation

#### 1. **Firebase Authentication**
```typescript
// /src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCwI4aE5-p-NYm60p97IG0aKijccPI0sxI",
  authDomain: "prime-media-7216b.firebaseapp.com",
  projectId: "prime-media-7216b",
  storageBucket: "prime-media-7216b.firebasestorage.app",
  messagingSenderId: "497607749297",
  appId: "1:497607749297:web:d113e9a79fd1799f803c90"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const storage = getStorage(app);
```

#### 2. **User Authentication Flow**
```typescript
// Login.tsx
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

// Sign in or create account
try {
  await signInWithEmailAndPassword(auth, email, password);
} catch (error) {
  // If user doesn't exist, create account
  await createUserWithEmailAndPassword(auth, email, password);
}
```

#### 3. **File Upload to Firebase Storage**
```typescript
// UploadComposition.tsx
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

// Create storage reference
const storageRef = ref(storage, `compositions/${Date.now()}_${pdfFile.name}`);

// Upload with progress tracking
const uploadTask = uploadBytesResumable(storageRef, pdfFile);

uploadTask.on('state_changed',
  (snapshot) => {
    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
    setUploadProgress(progress);
  },
  (error) => {
    // Handle error
  },
  async () => {
    // Get download URL
    const pdfUrl = await getDownloadURL(uploadTask.snapshot.ref);
    // Save to database with pdfUrl
  }
);
```

### Next Steps for Full Firebase Integration

#### 1. **Add Firestore Database**
```typescript
// Add to firebase.ts
import { getFirestore } from "firebase/firestore";
export const db = getFirestore(app);
```

#### 2. **Create Database Service Layer**
```typescript
// /src/lib/database.ts
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  getDocs 
} from 'firebase/firestore';
import { db } from './firebase';

// Compositions
export const createComposition = async (data) => {
  return await addDoc(collection(db, 'compositions'), data);
};

export const getCompositions = async (filters) => {
  let q = query(collection(db, 'compositions'));
  // Apply filters
  return await getDocs(q);
};

// Purchases
export const createPurchase = async (data) => {
  return await addDoc(collection(db, 'purchases'), data);
};

// Users
export const createUserProfile = async (userId, data) => {
  return await setDoc(doc(db, 'users', userId), data);
};
```

---

## Security & Authentication

### Firebase Security Rules

#### Firestore Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return request.auth.uid == userId;
    }
    
    function isAdmin() {
      return isAuthenticated() && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    function isComposer() {
      return isAuthenticated() && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'composer';
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() && isOwner(userId);
      allow update: if isOwner(userId) || isAdmin();
      allow delete: if isAdmin();
    }
    
    // Compositions collection
    match /compositions/{compositionId} {
      allow read: if true; // Public browsing
      allow create: if isComposer();
      allow update: if isAdmin() || 
                      (isComposer() && resource.data.composerId == request.auth.uid);
      allow delete: if isAdmin() || 
                      (isComposer() && resource.data.composerId == request.auth.uid);
    }
    
    // Purchases collection
    match /purchases/{purchaseId} {
      allow read: if isAdmin() || 
                     isOwner(resource.data.buyerId);
      allow create: if isAuthenticated();
      allow update: if isAdmin();
      allow delete: if isAdmin();
    }
  }
}
```

#### Storage Rules
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    // Composition PDFs
    match /compositions/{compositionFile} {
      // Only composers can upload
      allow write: if request.auth != null && 
                     request.auth.token.role == 'composer';
      
      // Only buyers who purchased can download
      allow read: if request.auth != null && (
        // Check if user purchased this composition
        exists(/databases/$(database)/documents/purchases/
          $(request.auth.uid + '_' + compositionFile)) ||
        // Or is admin
        request.auth.token.role == 'admin' ||
        // Or is the composer who uploaded it
        request.auth.token.role == 'composer'
      );
    }
  }
}
```

---

## Transaction Flow

### Complete Purchase Transaction

```typescript
// 1. User clicks "Complete Purchase" in Buyer Dashboard
async function completePurchase(cartItems: CartItem[], userId: string) {
  
  // 2. Calculate total
  const total = cartItems.reduce((sum, item) => 
    sum + (item.composition.price * item.quantity), 0
  );
  
  // 3. Process payment (integrate Stripe/PayPal)
  const paymentResult = await processPayment({
    amount: total,
    currency: 'USD',
    userId: userId
  });
  
  if (!paymentResult.success) {
    throw new Error('Payment failed');
  }
  
  // 4. Create purchase records
  const purchasePromises = cartItems.map(async (item) => {
    return await createPurchase({
      compositionId: item.composition.id,
      buyerId: userId,
      price: item.composition.price,
      purchaseDate: new Date(),
      transactionId: paymentResult.transactionId,
      paymentMethod: paymentResult.method,
      status: 'completed',
      // Denormalized data
      compositionTitle: item.composition.title,
      composerName: item.composition.composerName,
      buyerName: currentUser.name,
      buyerEmail: currentUser.email
    });
  });
  
  await Promise.all(purchasePromises);
  
  // 5. Update analytics (increment purchase counts)
  const updatePromises = cartItems.map(async (item) => {
    const compositionRef = doc(db, 'compositions', item.composition.id);
    await updateDoc(compositionRef, {
      purchaseCount: increment(1)
    });
  });
  
  await Promise.all(updatePromises);
  
  // 6. Clear cart
  clearCart();
  
  // 7. Send confirmation email (Cloud Function)
  await sendPurchaseConfirmation({
    userId,
    items: cartItems,
    total,
    transactionId: paymentResult.transactionId
  });
  
  // 8. Return success
  return {
    success: true,
    purchases: purchasePromises,
    transactionId: paymentResult.transactionId
  };
}
```

---

## Performance Optimization

### 1. **Data Denormalization**
Store frequently accessed data together to avoid joins:
- Store `composerName` in `compositions` (avoid joining with users)
- Store composition details in `purchases` (for fast transaction history)

### 2. **Pagination**
```typescript
// Firestore pagination
const firstPage = query(
  collection(db, 'compositions'),
  orderBy('dateAdded', 'desc'),
  limit(20)
);

const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];

const nextPage = query(
  collection(db, 'compositions'),
  orderBy('dateAdded', 'desc'),
  startAfter(lastVisible),
  limit(20)
);
```

### 3. **Caching Strategy**
- Cache marketplace listings for 5 minutes
- Cache user profile data
- Invalidate cache on updates

### 4. **Indexes**
Create composite indexes for common filter combinations:
- `(status, difficulty, language)`
- `(composerId, dateAdded desc)`
- `(buyerId, purchaseDate desc)`

---

## Analytics & Reporting

### Key Metrics to Track

#### Platform Level (Admin)
- Total Users (by role)
- Total Compositions
- Total Revenue
- Active Users (last 30 days)
- Growth Rate (month-over-month)

#### Composer Level
- Total Compositions Published
- Total Sales Count
- Total Revenue
- Average Price per Sale
- Most Popular Composition
- Sales by Month

#### Buyer Level
- Total Purchases
- Total Spent
- Favorite Composers
- Recent Activity

### Example Analytics Query
```typescript
// Revenue by month
const getRevenueByMonth = async (year: number) => {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  
  const q = query(
    collection(db, 'purchases'),
    where('purchaseDate', '>=', startDate),
    where('purchaseDate', '<=', endDate),
    where('status', '==', 'completed')
  );
  
  const snapshot = await getDocs(q);
  
  const monthlyRevenue = Array(12).fill(0);
  snapshot.docs.forEach(doc => {
    const month = doc.data().purchaseDate.toDate().getMonth();
    monthlyRevenue[month] += doc.data().price;
  });
  
  return monthlyRevenue;
};
```

---

## Future Enhancements

### Phase 2 Features
1. **Reviews & Ratings** - Allow buyers to review compositions
2. **Wishlists** - Save compositions for later
3. **Advanced Search** - Full-text search with Algolia/Typesense
4. **Email Notifications** - Purchase confirmations, new uploads
5. **Sample Previews** - Audio/PDF preview before purchase
6. **Bulk Discounts** - Pricing tiers for multiple purchases
7. **Subscription Plans** - Monthly access to all compositions

### Phase 3 Features
1. **Social Features** - Follow composers, share compositions
2. **Recommendations** - AI-powered composition suggestions
3. **Mobile Apps** - iOS/Android native apps
4. **API for Third-party Integration**
5. **Advanced Analytics Dashboard** - Charts, graphs, export
6. **Multi-language Support** - i18n implementation
7. **Payment Gateway Options** - Stripe, PayPal, Apple Pay

---

## Deployment Checklist

### Before Production
- [ ] Set up production Firebase project
- [ ] Configure Firestore security rules
- [ ] Configure Storage security rules
- [ ] Set up Cloud Functions for server-side logic
- [ ] Integrate payment gateway (Stripe/PayPal)
- [ ] Set up email service (SendGrid/AWS SES)
- [ ] Configure environment variables
- [ ] Set up error monitoring (Sentry)
- [ ] Set up analytics (Google Analytics/Mixpanel)
- [ ] Create backup strategy
- [ ] Set up CI/CD pipeline
- [ ] Performance testing
- [ ] Security audit
- [ ] Legal compliance (GDPR, terms of service)

---

## Support & Maintenance

### Monitoring
- **Uptime:** Firebase Console
- **Errors:** Sentry / Firebase Crashlytics
- **Performance:** Firebase Performance Monitoring
- **User Analytics:** Google Analytics

### Backup Strategy
- **Database:** Automated Firestore backups (daily)
- **Storage:** Firebase Storage redundancy (automatic)
- **Code:** Git version control with GitHub

---

**End of Documentation**

For questions or support, contact the development team.
