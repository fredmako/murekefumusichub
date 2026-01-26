# Supabase Storage & Database Integration Guide

## Overview

This guide explains how the application integrates **Firebase Authentication** with **Supabase** for database and file storage.

### Architecture
- **Authentication**: Firebase (OAuth, Email/Password)
- **Database**: Supabase PostgreSQL
- **File Storage**: Supabase Storage (S3-compatible)
- **User Link**: Firebase UID stored in Supabase `users.firebase_uid`

---

## 1. Supabase Storage Setup

### Create Storage Buckets

In your Supabase Console, go to **Storage** and create three public buckets:

#### 1.1 Compositions Bucket
```
Name: compositions
Public: Yes (allows public file access)
```
**Purpose**: Store PDF scores and music files uploaded by composers

#### 1.2 Thumbnails Bucket
```
Name: thumbnails
Public: Yes
```
**Purpose**: Store composition cover images/thumbnails

#### 1.3 Avatars Bucket
```
Name: avatars
Public: Yes
```
**Purpose**: Store user profile pictures

### Storage Security Rules (RLS)

For each bucket, set the following policies in **Storage > Policies**:

#### Compositions Bucket Policies

**Read Policy (Public)**
```sql
-- Anyone can read compositions
CREATE POLICY "Allow public read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'compositions');
```

**Upload Policy (Authenticated)**
```sql
-- Only authenticated users can upload their own files
CREATE POLICY "Allow users to upload their own compositions" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'compositions'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

**Delete Policy (Owner)**
```sql
-- Only file owners can delete
CREATE POLICY "Allow users to delete their own compositions" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'compositions'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

#### Avatars & Thumbnails Buckets - Similar policies

Apply the same pattern for `avatars` and `thumbnails` buckets, replacing the bucket names.

---

## 2. Database Schema Updates

### File Uploads Table

This table tracks all file uploads for auditing and management:

```sql
CREATE TABLE IF NOT EXISTS file_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INT NOT NULL,
  bucket TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_file_uploads_user_id ON file_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_bucket ON file_uploads(bucket);
CREATE INDEX IF NOT EXISTS idx_file_uploads_file_path ON file_uploads(file_path);
```

### Link Firebase UID to Supabase User

Ensure your `users` table has a `firebase_uid` column:

```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS firebase_uid TEXT UNIQUE;
```

---

## 3. Using Supabase Storage in Your App

### Import the Storage Service

```typescript
import { 
  uploadComposition, 
  uploadThumbnail, 
  uploadAvatar, 
  deleteFile, 
  getUserFiles 
} from '@/services/supabaseStorage';
```

### Upload Composition File

```typescript
import { uploadComposition } from '@/services/supabaseStorage';

async function handleCompositionUpload(file: File) {
  try {
    const result = await uploadComposition(file, (progress) => {
      console.log(`Upload progress: ${progress}%`);
    });
    
    console.log('Upload successful!');
    console.log('File URL:', result.url);
    console.log('File Path:', result.path);
    
    // Store the URL in your composition database record
    return result.url;
  } catch (error) {
    console.error('Upload failed:', error);
  }
}
```

### Upload Thumbnail

```typescript
import { uploadThumbnail } from '@/services/supabaseStorage';

async function handleThumbnailUpload(file: File) {
  try {
    const result = await uploadThumbnail(file);
    return result.url;
  } catch (error) {
    console.error('Thumbnail upload failed:', error);
  }
}
```

### Upload Avatar

```typescript
import { uploadAvatar } from '@/services/supabaseStorage';

async function handleAvatarUpload(file: File) {
  try {
    const result = await uploadAvatar(file);
    return result.url;
  } catch (error) {
    console.error('Avatar upload failed:', error);
  }
}
```

### Delete File

```typescript
import { deleteFile } from '@/services/supabaseStorage';

async function handleFileDelete(filePath: string) {
  try {
    await deleteFile('compositions', filePath);
    console.log('File deleted successfully');
  } catch (error) {
    console.error('Delete failed:', error);
  }
}
```

### Get User's Files

```typescript
import { getUserFiles } from '@/services/supabaseStorage';

async function listUserCompositions() {
  try {
    const files = await getUserFiles('compositions');
    console.log('User compositions:', files);
  } catch (error) {
    console.error('Error fetching files:', error);
  }
}
```

---

## 4. File Path Structure

Files are organized by user's Firebase UID:

```
compositions/
├── firebase-uid-1/
│   ├── 1706000000000-symphony.pdf
│   └── 1706000001000-hymn.pdf
├── firebase-uid-2/
│   └── 1706000002000-waltz.pdf

avatars/
├── firebase-uid-1/
│   └── 1706000003000-profile.jpg
├── firebase-uid-2/
│   └── 1706000004000-avatar.png

thumbnails/
├── firebase-uid-1/
│   ├── 1706000005000-symphony-cover.jpg
│   └── 1706000006000-hymn-cover.jpg
```

### Why This Structure?

- **Security**: Firebase UID as folder ensures users can only manage their own files
- **Organization**: Timestamp prevents filename collisions
- **Scalability**: Easy to delete all user files by folder
- **Privacy**: Follows Supabase best practices for user-scoped storage

---

## 5. Environment Variables

Make sure your `.env.local` file contains:

```env
# Firebase
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-auth-domain
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-storage-bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id

# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## 6. Authentication Flow with Supabase

When a user authenticates with Firebase:

```
1. User logs in with Firebase
   └─> Firebase generates UID and ID Token

2. App syncs user with Supabase
   └─> Create/Update users table with firebase_uid

3. All file uploads use Firebase UID
   └─> Files stored in path: {bucket}/{firebase_uid}/{filename}

4. Database tracks uploads in file_uploads table
   └─> Links to users.id (Supabase UUID)
```

---

## 7. Type Definitions

```typescript
// From src/services/supabaseStorage.ts

export type StorageBucket = 'compositions' | 'thumbnails' | 'avatars';

export interface UploadOptions {
  bucket: StorageBucket;
  onProgress?: (progress: number) => void;
}

export interface UploadResult {
  id: string;
  url: string;
  path: string;
}

// From src/lib/supabase.ts

export interface FileUpload {
  id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  bucket: 'compositions' | 'thumbnails' | 'avatars';
  storage_url: string;
  created_at: string;
  updated_at: string;
}
```

---

## 8. Best Practices

### Do's ✅
- Always authenticate before uploading files
- Use the provided service functions for uploads
- Validate file types before uploading
- Store file URLs in your database
- Use signed URLs for private/paid content
- Clean up files when deleting compositions

### Don'ts ❌
- Don't hardcode bucket names
- Don't bypass the service layer
- Don't upload files without Firebase authentication
- Don't assume all files are public
- Don't forget to delete associated files when deleting records

---

## 9. Troubleshooting

### "User must be authenticated to upload files"
- Ensure user is logged in via Firebase before uploading
- Check Firebase session is active

### "File already exists"
- Change `upsert: false` to `upsert: true` in supabaseStorage.ts to overwrite
- Or add timestamp to filename to ensure uniqueness

### Storage quota exceeded
- Check Supabase storage limits
- Delete old/unused files
- Consider upgrading your plan

### "Permission denied" when deleting
- Only file owners can delete their own files
- Check that filePath starts with user's Firebase UID
- Verify storage RLS policies are set correctly

---

## 10. Migration from Firebase Storage

If migrating from Firebase Storage:

```typescript
import { uploadFile } from '@/services/supabaseStorage';

async function migrateFileFromFirebase(firebaseUrl: string) {
  try {
    // Download file from Firebase
    const response = await fetch(firebaseUrl);
    const blob = await response.blob();
    const file = new File([blob], 'migrated-file');
    
    // Upload to Supabase
    const result = await uploadFile(file, {
      bucket: 'compositions'
    });
    
    return result.url;
  } catch (error) {
    console.error('Migration failed:', error);
  }
}
```

---

For more information, visit:
- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [Firebase Authentication Documentation](https://firebase.google.com/docs/auth)
- [Supabase Guides](https://supabase.com/docs)
