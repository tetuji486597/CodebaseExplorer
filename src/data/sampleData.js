export const CONCEPT_COLORS = {
  teal: { fill: '#0d2d2a', stroke: '#10b981', text: '#6ee7b7', accent: '#10b981', fillLight: '#9FE1CB', strokeLight: '#0F6E56', textLight: '#04342C' },
  purple: { fill: '#1e1b4b', stroke: '#8b5cf6', text: '#c4b5fd', accent: '#8b5cf6', fillLight: '#CECBF6', strokeLight: '#534AB7', textLight: '#26215C' },
  coral: { fill: '#3b1218', stroke: '#ef4444', text: '#fca5a5', accent: '#ef4444', fillLight: '#F5C4B3', strokeLight: '#993C1D', textLight: '#4A1B0C' },
  blue: { fill: '#0c1e3a', stroke: '#6366f1', text: '#a5b4fc', accent: '#6366f1', fillLight: '#B5D4F4', strokeLight: '#185FA5', textLight: '#042C53' },
  amber: { fill: '#2d1f05', stroke: '#f59e0b', text: '#fcd34d', accent: '#f59e0b', fillLight: '#FAC775', strokeLight: '#BA7517', textLight: '#412402' },
  pink: { fill: '#2d1226', stroke: '#ec4899', text: '#f9a8d4', accent: '#ec4899', fillLight: '#F4C0D1', strokeLight: '#993556', textLight: '#4B1528' },
  green: { fill: '#0d2818', stroke: '#06b6d4', text: '#67e8f9', accent: '#06b6d4', fillLight: '#C0DD97', strokeLight: '#3B6D11', textLight: '#173404' },
  gray: { fill: '#1a1a2e', stroke: '#94a3b8', text: '#cbd5e1', accent: '#94a3b8', fillLight: '#D3D1C7', strokeLight: '#5F5E5A', textLight: '#2C2C2A' },
};

export const COLOR_NAMES = Object.keys(CONCEPT_COLORS);

export const sampleConcepts = [
  {
    id: 'auth',
    name: 'Sign In / Sign Up',
    emoji: '🔑',
    color: 'teal',
    description: 'Handles user registration, login, and authentication. Manages secure user sessions and password verification.',
    metaphor: 'Like the bouncer at a nightclub -- checks your ID at the door, stamps your hand so you can come and go, and remembers who is allowed in.',
    importance: 'critical',
    deep_explanation: 'The authentication system is the security backbone of the entire application. It implements a multi-layered approach: bcrypt password hashing with configurable salt rounds for secure credential storage, JWT tokens with short-lived access tokens and longer-lived refresh tokens for session management, and middleware-based route protection that validates tokens on every protected request.\n\nThe registration flow includes email uniqueness validation, password strength requirements, and a verification email loop. The login flow uses constant-time comparison for password checking to prevent timing attacks. Sessions are stateless via JWT, meaning the server does not need to store session data -- the token itself contains the user identity, signed with a secret key.\n\nTrade-offs in this design include choosing JWTs over server-side sessions (better horizontal scalability but harder to revoke), bcrypt over argon2 (wider library support but slightly less resistant to GPU attacks), and storing refresh tokens in httpOnly cookies rather than localStorage (XSS-resistant but requires CSRF protection).',
    beginner_explanation: 'This is the part of the app that handles logging in and creating new accounts. When you type your email and password, this code checks if they are correct. It is like a digital lock on the front door -- only people with the right key can get in. Once you are logged in, it gives you a special pass so you do not have to type your password on every page.',
    intermediate_explanation: 'The auth system uses bcrypt to hash passwords before storing them in the database, so even if the database is compromised, raw passwords are not exposed. After successful login, the server issues a JWT (JSON Web Token) that the client includes in the Authorization header of subsequent requests. An Express middleware intercepts protected routes, verifies the JWT signature, and attaches the decoded user object to the request. Registration includes duplicate-email checks and input validation before creating the user record.',
    advanced_explanation: 'The auth layer implements a stateless JWT strategy with access/refresh token rotation. Access tokens are short-lived (15 min) and carried in Authorization headers; refresh tokens are stored in httpOnly secure cookies with SameSite=Strict to mitigate XSS and CSRF vectors. Password hashing uses bcrypt with 12 salt rounds, providing ~300ms hash time to resist brute-force attacks. The AuthService is injected into route handlers via dependency injection, enabling isolated unit testing with mocked repositories. Token revocation is handled via a server-side denylist checked in the auth middleware, with entries TTL-matched to the token expiry to keep the list bounded. Rate limiting on /login (5 attempts per 15 min per IP) is enforced at the reverse-proxy layer.',
  },
  {
    id: 'feed',
    name: 'Home Feed',
    emoji: '🏠',
    color: 'purple',
    description: 'Displays a personalized stream of posts from users you follow. Loads and refreshes content as you scroll.',
    metaphor: 'Like a newspaper that rewrites itself every time you pick it up, showing you stories only from writers you have subscribed to.',
    importance: 'important',
    deep_explanation: 'The feed system is the primary content delivery mechanism and arguably the most performance-sensitive part of the application. It uses a fan-out-on-read approach: when a user opens their feed, the system queries the posts table for all authors the user follows, sorted by recency, with cursor-based pagination to efficiently handle infinite scroll.\n\nOn the frontend, the feed uses an IntersectionObserver-based infinite scroll hook that detects when the user approaches the bottom of the loaded content and triggers the next page fetch. Posts are rendered in a virtualized list to keep DOM node count manageable even after loading hundreds of posts. The feed also implements optimistic UI updates for likes and comments -- the UI updates instantly while the API call happens in the background.\n\nKey architectural decisions include cursor-based pagination over offset-based (avoids duplicates when new posts are inserted), client-side caching with stale-while-revalidate semantics, and prefetching the first page on app launch to minimize perceived load time. The feed service layer abstracts the pagination logic so the UI components never deal with page tokens directly.',
    beginner_explanation: 'This is your home page -- the scrolling list of photos and videos from people you follow. Every time you open the app, it loads the latest posts for you. As you scroll down, it keeps loading more. Think of it like a never-ending photo album that always has something new at the top.',
    intermediate_explanation: 'The feed fetches posts from followed users via a paginated API, using cursor-based pagination (a "page token" pointing to the last loaded post) rather than offset-based pagination to avoid duplicates. An IntersectionObserver hook triggers the next page load when the user scrolls near the bottom. The feed state is managed via React hooks that track loaded posts, loading state, and whether more content is available. Likes and comments use optimistic updates for instant feedback.',
    advanced_explanation: 'The feed implements fan-out-on-read with a composite index on (author_id, created_at DESC) for efficient timeline construction. Cursor-based pagination uses the last post ID + timestamp as an opaque page token, ensuring stable iteration even under concurrent writes. The frontend uses a custom useInfiniteScroll hook backed by IntersectionObserver with a rootMargin threshold to prefetch before the user reaches the bottom. Post components are memoized with React.memo and keyed by post ID to minimize re-renders during appends. The feed service maintains an in-memory LRU cache of recent pages, invalidated via WebSocket events when followed users publish new content.',
  },
  {
    id: 'posts',
    name: 'Posts',
    emoji: '📸',
    color: 'coral',
    description: 'Manages creating, editing, and deleting posts. Handles post metadata like captions, hashtags, and timestamps.',
    metaphor: 'Like pinning a photo to a community bulletin board -- you write a caption, stick it up, and everyone walking by can see it, like it, or leave a note.',
    importance: 'critical',
    deep_explanation: 'The posts system is the core content entity of the application. It manages the full lifecycle of user-generated content: creation with image upload, caption and hashtag parsing, editing, deletion, and engagement tracking (likes, comments, shares). The Post model is the most referenced entity in the database, with foreign key relationships to users, comments, likes, and media.\n\nPost creation is a multi-step process: the client uploads images via the media service first, receives URLs, then submits the post with those URLs plus caption and metadata. Hashtags are parsed from the caption using a regex pattern and stored both inline and in a separate hashtags table for efficient search indexing. The PostService handles CRUD operations through a clean API layer, with each operation triggering appropriate side effects (e.g., creating a post increments the author profile post count, deleting cascades to comments and likes).\n\nThe post card component implements lazy image loading, timestamp formatting with relative time display, and engagement action buttons with optimistic updates. The comments subsystem supports threaded replies with a recursive data model and paginated loading for posts with many comments.',
    beginner_explanation: 'Posts are the photos and videos people share on the app. This part of the code handles everything about a post -- uploading the picture, writing a caption, adding hashtags, and letting other people like or comment on it. When you hit "share," this is the code that saves your post and shows it to your followers.',
    intermediate_explanation: 'The posts module handles CRUD operations for user content. Post creation involves uploading media files first (via the media service), then saving the post record with image URLs, parsed hashtags, and metadata. The PostService exposes create/read/update/delete methods that communicate with the REST API. Post components like PostCard handle display concerns including relative timestamp formatting, lazy image loading, and like/comment interactions with optimistic UI updates. The Comment subsystem is nested within posts, supporting threaded replies.',
    advanced_explanation: 'Posts use a denormalized schema with like_count and comment_count maintained via database triggers to avoid expensive COUNT queries on read. Hashtag extraction uses a regex parser that runs both client-side (for preview) and server-side (as source of truth). The post creation endpoint is transactional -- it inserts the post record, hashtag associations, and updates the user post count atomically. Deletion uses CASCADE constraints for comments and likes but soft-deletes the post record itself for abuse review. The PostCard component implements progressive image loading with blur-up placeholders generated at upload time, and engagement buttons use useOptimistic for instant feedback with automatic rollback on API failure.',
  },
  {
    id: 'profiles',
    name: 'User Profiles',
    emoji: '👤',
    color: 'blue',
    description: 'Shows user information, bio, profile picture, and follower lists. Allows users to edit their own profile.',
    metaphor: 'Like your personal business card and trophy case combined -- it shows who you are and everything you have shared.',
    importance: 'important',
    deep_explanation: 'The profiles system manages user identity and social connections. Each profile displays the user\'s public information (display name, bio, avatar), engagement metrics (post count, follower count, following count), and a grid of their posts. The profile also serves as the hub for social graph operations -- following and unfollowing other users.\n\nThe ProfileService handles data fetching and mutations, including optimistic follower count updates when following/unfollowing. The profile screen uses React Router params to load any user\'s profile by ID, with conditional rendering to show edit controls when viewing your own profile. The edit profile screen provides form inputs for display name, bio, and avatar upload, with client-side validation and server-side uniqueness checks for usernames.\n\nThe follower/following relationship is stored in a separate Follow table with a composite unique constraint to prevent duplicate follows. Follower counts are denormalized on the User record for fast reads, updated via database triggers when follows are created or deleted. The profile posts grid uses a masonry-style layout with lazy loading and pagination.',
    beginner_explanation: 'Your profile is like your personal page on the app. It shows your name, a short bio about yourself, your profile picture, and all the photos you have posted. Other people can visit your profile to see your posts and decide to follow you. You can also edit your profile to change your picture or update your bio.',
    intermediate_explanation: 'The profiles module fetches and displays user data including bio, avatar, post count, and follower/following counts. It uses React Router to load profiles by user ID and conditionally renders edit controls for the authenticated user\'s own profile. The follow/unfollow feature updates follower counts optimistically and persists via the ProfileService API. Profile editing validates inputs client-side and the server enforces username uniqueness. The posts grid lazy-loads the user\'s posts with pagination.',
    advanced_explanation: 'Profile data is split between a hot path (username, avatar_url, follower_count -- cached aggressively) and a cold path (bio, posts grid -- fetched on demand). The follow relationship uses a junction table with a composite unique index on (follower_id, following_id) and a reverse index for efficient "followers of X" queries. Follower counts are denormalized and kept consistent via Postgres AFTER INSERT/DELETE triggers on the follows table. The profile screen prefetches the first page of posts in parallel with the profile data fetch using Promise.all. Avatar uploads go through the media pipeline with automatic resizing to 150x150, 320x320, and 640x640 variants.',
  },
  {
    id: 'notifications',
    name: 'Notifications',
    emoji: '🔔',
    color: 'amber',
    description: 'Alerts users about likes, comments, follows, and other interactions. Manages notification preferences and delivery.',
    metaphor: 'Like a personal assistant who taps you on the shoulder whenever someone interacts with your work -- "Hey, someone liked your photo!"',
    importance: 'supporting',
    deep_explanation: 'The notification system is an event-driven subsystem that tracks user interactions and delivers alerts through multiple channels: in-app notifications, push notifications, and email digests. When an action occurs (like, comment, follow, mention), the originating service emits a notification event that is processed by the notification handler.\n\nIn-app notifications are stored in a database table with fields for type, actor, target, message, read status, and timestamp. The notifications screen fetches these with pagination and groups them by time period. Real-time delivery uses Server-Sent Events (SSE) for the in-app feed and WebSocket connections for push notifications, with a fallback to polling for environments where persistent connections are not available.\n\nThe PushNotificationHandler manages the WebSocket lifecycle, including automatic reconnection with exponential backoff. Desktop notifications use the browser Notification API with permission management. The system supports notification preferences per user, allowing them to mute specific notification types or disable push notifications entirely. Batch processing handles high-fanout events (e.g., a celebrity post getting millions of likes) by aggregating notifications ("and 1,234 others liked your post").',
    beginner_explanation: 'Notifications are the alerts you get when something happens -- like when someone likes your photo, leaves a comment, or starts following you. This part of the app keeps track of all those events and shows them to you in a list. It can also send you a pop-up on your phone or computer so you know right away.',
    intermediate_explanation: 'The notification system captures interaction events (likes, comments, follows, mentions) and delivers them through multiple channels. In-app notifications are stored in a database table and displayed in a paginated list with read/unread status. Real-time delivery uses Server-Sent Events for the notification feed and WebSocket connections for push alerts. The PushNotificationHandler manages WebSocket lifecycle with auto-reconnect. The browser Notification API handles desktop push notifications with permission management.',
    advanced_explanation: 'Notifications use an event-driven architecture where services emit events consumed by the notification handler asynchronously. High-fanout events (celebrity posts) use aggregation to collapse thousands of similar notifications into a single entry with a count. Real-time delivery is layered: SSE for the notification feed (simpler, HTTP-compatible), WebSocket for push (bidirectional, lower latency), with long-polling fallback. The notification table is partitioned by user_id for query performance and uses a partial index on (user_id, is_read) WHERE is_read = false for efficient unread count queries. Notification preferences are cached in Redis with a TTL matching the user session length.',
  },
  {
    id: 'media',
    name: 'Media Storage',
    emoji: '🗂️',
    color: 'pink',
    description: 'Stores and serves images and videos. Handles file uploads, compression, and efficient retrieval.',
    metaphor: 'Like a giant warehouse with a sorting system -- photos come in, get organized, resized, and filed away so they can be found and delivered quickly.',
    importance: 'supporting',
    deep_explanation: 'The media storage system is responsible for ingesting, processing, storing, and serving all binary content (images and videos) in the application. It sits behind a service layer that abstracts the storage backend (currently S3-compatible object storage) from the rest of the application.\n\nThe upload pipeline processes files through several stages: validation (file type, size limits), virus scanning, image processing (resizing to multiple dimensions, format conversion to WebP for bandwidth savings, EXIF metadata stripping for privacy), and finally storage with a content-addressable naming scheme. Each uploaded file generates multiple variants (thumbnail, medium, full) stored with predictable URL patterns.\n\nThe MediaCache implements an in-memory LRU cache using a singleton pattern, reducing redundant network requests for frequently accessed media metadata. It uses time-based expiration (1 hour TTL) and size-based eviction (max 100 entries) to bound memory usage. The ImageUploader component provides a drag-and-drop interface with file preview, multi-file selection, and upload progress tracking. Video uploads additionally generate a poster thumbnail frame.\n\nKey architectural decisions include content-addressable storage (deduplication of identical uploads), CDN integration for edge caching, and signed URLs for access control on private content.',
    beginner_explanation: 'This is where all the photos and videos are stored. When you upload a picture, this system saves it, creates smaller versions for faster loading, and makes sure it can be shown to anyone who wants to see it. Think of it like a photo printing service that also files and organizes everything for you.',
    intermediate_explanation: 'The media module handles file uploads via multipart form data, stores files in cloud object storage (S3-compatible), and generates multiple size variants (thumbnail, medium, full) for responsive delivery. The MediaService provides upload, delete, and optimization endpoints. An in-memory LRU cache (MediaCache singleton) reduces redundant metadata fetches with TTL-based expiration. The ImageUploader component supports drag-and-drop, multi-file selection, and integrates with the media service for uploads. Video uploads include automatic thumbnail generation.',
    advanced_explanation: 'The media pipeline uses content-addressable storage (SHA-256 of file content as key) for automatic deduplication. Uploads are processed asynchronously via a job queue: validation, virus scan, EXIF stripping, and multi-variant generation (WebP conversion, resize to 150/640/1080px widths). The MediaCache is a singleton LRU with O(1) get/set using a Map with timestamp-based eviction and a configurable max size. Signed URLs with short TTLs (15 min) control access to private media. A CDN layer with cache-control headers (immutable, max-age=31536000) serves public variants, with cache invalidation via surrogate keys on deletion. Upload progress uses XMLHttpRequest with onUploadProgress for accurate byte-level tracking.',
  },
  {
    id: 'search',
    name: 'Search',
    emoji: '🔍',
    color: 'green',
    description: 'Allows users to find posts, users, and hashtags. Provides fast search results with filtering options.',
    metaphor: 'Like a librarian who knows where everything is -- you describe what you are looking for, and they pull the right results from millions of entries in seconds.',
    importance: 'supporting',
    deep_explanation: 'The search system provides full-text search across three content types: posts (by caption and hashtag), users (by username and display name), and hashtags (by tag text with post count). It uses a debounced search input to avoid excessive API calls during typing, with a 300ms delay before firing the search request.\n\nThe search architecture uses a tabbed interface with "All", "Posts", "Users", and "Hashtags" filters. Results are grouped by type in the display, with type-specific rendering (user results show avatars, post results show thumbnails, hashtag results show post counts). The SearchService maintains a recent searches history in localStorage, providing quick access to previous queries.\n\nOn the backend, search queries hit a Postgres full-text search index using tsvector columns for posts and users. Hashtag search uses a prefix-match B-tree index for instant autocomplete. The search API supports pagination and returns results ranked by relevance score. For scale, the system is designed to be migrated to Elasticsearch when the dataset grows beyond what Postgres FTS handles efficiently.\n\nThe search results component uses a grouped layout with section headers, lazy-loaded images, and click handlers that navigate to the appropriate detail view (post detail, user profile, or hashtag feed).',
    beginner_explanation: 'Search lets you find anything on the app -- people, photos, or hashtags. You type what you are looking for in a search bar, and the app shows you matching results almost instantly. It is like using Google, but just for things inside the Instagram app.',
    intermediate_explanation: 'The search module provides a debounced text input (300ms delay) that queries the backend for posts, users, and hashtags. Results are grouped by type and displayed in a tabbed interface. The SearchService communicates with REST endpoints that use Postgres full-text search indexes. Recent searches are persisted in localStorage for quick re-access. The SearchResults component renders type-specific result cards with avatars for users, thumbnails for posts, and post counts for hashtags.',
    advanced_explanation: 'Search uses Postgres tsvector/tsquery with GIN indexes for full-text search on posts.caption and users.username/display_name columns, with ts_rank for relevance scoring. Hashtag search uses a prefix-match query on a B-tree index for O(log n) autocomplete. The frontend implements a debounce with useEffect cleanup (clearTimeout on unmount/re-render) to cancel stale requests. Search results are deduplicated client-side by ID. The architecture supports migration to Elasticsearch via a search adapter interface -- the SearchService already abstracts the backend, so swapping implementations requires no UI changes. Query analytics are logged for search ranking improvements.',
  },
  {
    id: 'database',
    name: 'Database',
    emoji: '🗄️',
    color: 'gray',
    description: 'The core data storage for all application information. Manages users, posts, relationships, and metrics.',
    metaphor: 'Like the foundation and filing cabinets of a building -- everything the app knows is stored here, organized in labeled drawers so any part of the system can find what it needs.',
    importance: 'critical',
    deep_explanation: 'The database layer is the persistence foundation for the entire application, implemented with PostgreSQL. It provides structured storage for all entities (users, posts, comments, likes, follows, notifications) with referential integrity enforced via foreign key constraints. The schema is managed through a versioned migration system that applies incremental changes in order.\n\nThe connection architecture uses a connection pool (pg Pool) with configurable limits: max 20 concurrent connections, 30-second idle timeout, and 2-second connection timeout. The pool is implemented as a singleton to ensure all parts of the application share connections efficiently. Error handling on idle connections prevents the pool from entering a degraded state.\n\nThe database models define TypeScript interfaces that mirror the database schema, providing type safety at the application layer. Key schema design decisions include: SERIAL primary keys for simplicity, denormalized counts (follower_count, like_count) for read performance, TIMESTAMP columns with DEFAULT CURRENT_TIMESTAMP for audit trails, and VARCHAR length limits that match business rules (255 for usernames, 500 for URLs).\n\nThe migration system supports forward-only migrations with sequential IDs, making it easy to track which migrations have been applied. Each migration is an idempotent function that creates tables, indexes, or alters schema. For production, migrations run in a transaction with automatic rollback on failure.',
    beginner_explanation: 'The database is where all the app\'s information lives permanently. Every user account, every photo post, every comment, every follow -- it is all saved here. Without the database, the app would forget everything the moment you closed it. Think of it as the app\'s memory bank.',
    intermediate_explanation: 'The database module configures a PostgreSQL connection pool using the pg library, managing up to 20 concurrent connections with idle timeout and error recovery. The schema is defined via a migration system that creates tables for users, posts, comments, likes, follows, and notifications with foreign key relationships. TypeScript interfaces mirror the database schema for type safety. The DatabaseConfig singleton ensures all services share the same pool. Denormalized count columns (like_count, follower_count) optimize read-heavy queries.',
    advanced_explanation: 'The database uses PostgreSQL with a pooled connection architecture (pg Pool, max 20, idle timeout 30s). The singleton pattern ensures connection reuse across the request lifecycle. Schema design uses denormalized counters maintained by AFTER INSERT/DELETE triggers to avoid COUNT(*) on hot tables. Indexes include composite indexes on (author_id, created_at DESC) for feed queries and partial indexes on (user_id, is_read) WHERE is_read = false for unread notification counts. Migrations are sequential and idempotent, run in transactions with savepoints for partial rollback. The models layer uses TypeScript interfaces (not an ORM) for transparency -- queries are hand-written SQL for control over execution plans. Connection health is monitored via periodic SELECT NOW() probes.',
  },
  {
    id: 'email',
    name: 'Email',
    emoji: '✉️',
    color: 'teal',
    description: 'Sends transactional emails to users for verification, password resets, and activity notifications.',
    metaphor: 'Like a postal service that sends official letters on behalf of the app -- welcome letters, password reset notices, and activity updates.',
    importance: 'supporting',
    deep_explanation: 'The email system handles all outbound transactional email communication using nodemailer with SMTP transport. It supports three primary email types: account verification (sent during registration), password reset (sent on user request), and activity notifications (sent for important interactions like new followers or comments on posts).\n\nThe EmailService is configured via environment variables for the SMTP connection (host, port, security, credentials), making it easy to swap between providers (SendGrid, AWS SES, Mailgun) without code changes. The email templates are implemented as static methods on the EmailTemplates class, returning HTML strings with inline styles for maximum email client compatibility. Template literals are used for dynamic content injection (tokens, usernames, action URLs).\n\nDesign considerations include: using inline CSS rather than stylesheets (many email clients strip <style> tags), keeping templates simple for deliverability (complex HTML triggers spam filters), including plain-text fallbacks for accessibility, and using environment-variable-based URLs so templates work across staging and production environments. Token-based links include expiration times (24 hours for verification, 1 hour for password reset) enforced on the server side.\n\nThe email system is designed to be called asynchronously -- the originating request does not wait for email delivery, preventing slow SMTP responses from blocking the user experience.',
    beginner_explanation: 'This part of the app sends emails to users. When you create a new account, it sends you a verification email. If you forget your password, it sends you a link to reset it. It can also email you about activity like new followers. These are automatic emails the app sends -- not messages between users.',
    intermediate_explanation: 'The email module uses nodemailer with SMTP transport to send transactional emails. The EmailService is configured via environment variables for provider flexibility. Three email types are supported: verification (with a tokenized confirmation link), password reset (with a time-limited reset link), and activity notifications. Templates use HTML with inline styles for email client compatibility. The service is called asynchronously so email delivery does not block the originating API request.',
    advanced_explanation: 'Email delivery uses nodemailer with configurable SMTP transport, abstracted behind an EmailService class for provider portability (SendGrid, SES, etc. via env vars). Templates use inline CSS and simple HTML to maximize deliverability scores and avoid spam filters. Token links embed HMAC-signed, time-limited tokens validated server-side (24h for verification, 1h for reset). The send path is fire-and-forget from the caller\'s perspective -- emails are enqueued and sent asynchronously to avoid blocking request handlers. In production, a dead-letter queue captures failed sends for retry. Rate limiting prevents abuse of the password reset endpoint (3 emails per hour per address).',
  },
];

export const sampleFiles = [
  // Sign In / Sign Up
  {
    id: 'file-1',
    name: 'auth.controller.ts',
    conceptId: 'auth',
    description: 'Handles HTTP requests for user authentication endpoints. Processes login and registration requests.',
    exports: [
      { name: 'AuthController', whatItDoes: 'Express router handling all authentication HTTP endpoints' },
      { name: 'loginRoute', whatItDoes: 'POST endpoint that validates credentials and creates a session' },
      { name: 'registerRoute', whatItDoes: 'POST endpoint that creates a new user account' },
      { name: 'logoutRoute', whatItDoes: 'POST endpoint that destroys the current user session' },
    ],
    codeSnippet: `import { Router, Request, Response } from 'express';
import { AuthService } from './auth.service';
import { validateEmail, hashPassword } from '../utils/validators';

const router = Router();
const authService = new AuthService();

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const user = await authService.authenticateUser(email, password);
    req.session.userId = user.id;
    res.json({ success: true, user });
  } catch (error) {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

router.post('/register', async (req: Request, res: Response) => {
  const { email, username, password } = req.body;
  const hashedPassword = hashPassword(password);
  const user = await authService.createUser(email, username, hashedPassword);
  res.status(201).json({ success: true, user });
});

export default router;`,
  },
  {
    id: 'file-2',
    name: 'auth.service.ts',
    conceptId: 'auth',
    description: 'Business logic for authentication. Verifies credentials and manages user sessions.',
    exports: [
      { name: 'AuthService', whatItDoes: 'Service class containing all authentication business logic' },
      { name: 'authenticateUser', whatItDoes: 'Validates email and password then returns a signed JWT' },
      { name: 'createUser', whatItDoes: 'Registers a new user after checking for duplicates' },
      { name: 'verifyToken', whatItDoes: 'Decodes and validates a JWT token string' },
    ],
    codeSnippet: `import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../repositories/user.repository';

export class AuthService {
  private userRepo = new UserRepository();
  private jwtSecret = process.env.JWT_SECRET;

  async authenticateUser(email: string, password: string) {
    const user = await this.userRepo.findByEmail(email);
    if (!user) throw new Error('User not found');

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) throw new Error('Invalid password');

    const token = jwt.sign({ userId: user.id }, this.jwtSecret, { expiresIn: '7d' });
    return { ...user, token };
  }

  async createUser(email: string, username: string, passwordHash: string) {
    const existingUser = await this.userRepo.findByEmail(email);
    if (existingUser) throw new Error('User already exists');

    return this.userRepo.create({ email, username, passwordHash });
  }

  verifyToken(token: string) {
    return jwt.verify(token, this.jwtSecret);
  }
}`,
  },
  {
    id: 'file-3',
    name: 'login.screen.tsx',
    conceptId: 'auth',
    description: 'React component displaying the login form interface.',
    exports: [
      { name: 'LoginScreen', whatItDoes: 'Full-page login form component with email and password fields' },
      { name: 'useLoginForm', whatItDoes: 'Custom hook managing login form state and submission' },
    ],
    codeSnippet: `import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { TextInput, Button, ErrorMessage } from '../components/common';
import styles from './login.module.css';

export const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, isLoading } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className={styles.container}>
      <h1>Welcome Back</h1>
      <form onSubmit={handleSubmit}>
        <TextInput label="Email" value={email} onChange={setEmail} />
        <TextInput label="Password" type="password" value={password} onChange={setPassword} />
        {error && <ErrorMessage message={error} />}
        <Button type="submit" disabled={isLoading}>Login</Button>
      </form>
    </div>
  );
};`,
  },
  {
    id: 'file-4',
    name: 'register.screen.tsx',
    conceptId: 'auth',
    description: 'React component for user registration interface with form validation.',
    exports: [
      { name: 'RegisterScreen', whatItDoes: 'Full-page registration form with client-side validation' },
    ],
    codeSnippet: `import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { validatePassword, validateEmail } from '../utils/validators';
import { TextInput, Button, CheckBox } from '../components/common';

export const RegisterScreen: React.FC = () => {
  const [formData, setFormData] = useState({ email: '', username: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { register, isLoading } = useAuth();

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!validateEmail(formData.email)) newErrors.email = 'Invalid email';
    if (formData.password.length < 8) newErrors.password = 'Password must be 8+ characters';
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords must match';
    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    await register(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <TextInput label="Email" value={formData.email} />
      <TextInput label="Username" value={formData.username} />
      <TextInput label="Password" type="password" value={formData.password} />
      <Button type="submit">Create Account</Button>
    </form>
  );
};`,
  },

  // Home Feed
  {
    id: 'file-5',
    name: 'feed.screen.tsx',
    conceptId: 'feed',
    description: 'Main feed screen component. Displays scrollable list of posts from followed users.',
    exports: [
      { name: 'FeedScreen', whatItDoes: 'Main page component rendering the infinite-scroll post feed' },
      { name: 'InfiniteFeed', whatItDoes: 'Wrapper component that manages scroll-based post loading' },
    ],
    codeSnippet: `import React, { useEffect, useState } from 'react';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { useFeed } from '../hooks/useFeed';
import { FeedItem } from './feedItem.component';
import { LoadingSpinner } from '../components/common';
import styles from './feed.module.css';

export const FeedScreen: React.FC = () => {
  const { posts, isLoading, hasMore, loadMore } = useFeed();
  const { setObserverTarget } = useInfiniteScroll(() => loadMore());

  return (
    <div className={styles.feedContainer}>
      <header className={styles.header}>
        <h1>Instagram</h1>
      </header>
      <div className={styles.postsContainer}>
        {posts.map(post => (
          <FeedItem key={post.id} post={post} />
        ))}
      </div>
      {isLoading && <LoadingSpinner />}
      <div ref={setObserverTarget} className={styles.loadTrigger} />
    </div>
  );
};`,
  },
  {
    id: 'file-6',
    name: 'feed.service.ts',
    conceptId: 'feed',
    description: 'Service layer for feed data operations. Fetches posts and manages pagination.',
    exports: [
      { name: 'FeedService', whatItDoes: 'Service class handling feed API communication and pagination' },
      { name: 'getFollowingPosts', whatItDoes: 'Fetches a page of posts from users the given user follows' },
      { name: 'getPaginatedFeed', whatItDoes: 'Fetches feed posts using cursor-based pagination tokens' },
      { name: 'prefetchFeed', whatItDoes: 'Preloads the first page of feed data for faster display' },
    ],
    codeSnippet: `import { HttpClient } from '../http/client';
import { Post } from '../models/post.model';

export class FeedService {
  private readonly baseUrl = '/api/feed';
  private pageSize = 10;

  async getFollowingPosts(userId: string, page: number = 1) {
    const response = await HttpClient.get<Post[]>(
      \`\${this.baseUrl}/following?userId=\${userId}&page=\${page}&limit=\${this.pageSize}\`
    );
    return response.data;
  }

  async getPaginatedFeed(userId: string, pageToken?: string) {
    const params = new URLSearchParams({ userId });
    if (pageToken) params.append('pageToken', pageToken);

    const response = await HttpClient.get(
      \`\${this.baseUrl}?\${params.toString()}\`
    );
    return { posts: response.data.posts, nextPageToken: response.data.nextPageToken };
  }

  async prefetchFeed(userId: string) {
    return this.getFollowingPosts(userId, 1);
  }

  async refreshFeed(userId: string) {
    return this.getFollowingPosts(userId, 1);
  }
}`,
  },
  {
    id: 'file-7',
    name: 'feedItem.component.tsx',
    conceptId: 'feed',
    description: 'Individual feed post component. Displays post content, engagement metrics, and interactions.',
    exports: [
      { name: 'FeedItem', whatItDoes: 'Renders a single post in the feed with image, actions, and caption' },
      { name: 'PostActions', whatItDoes: 'Row of like, comment, and share buttons for a post' },
    ],
    codeSnippet: `import React, { useState } from 'react';
import { Post } from '../models/post.model';
import { LikeButton, CommentButton, ShareButton } from '../components/interactions';
import { Avatar } from '../components/avatar';
import styles from './feedItem.module.css';

interface FeedItemProps {
  post: Post;
}

export const FeedItem: React.FC<FeedItemProps> = ({ post }) => {
  const [liked, setLiked] = useState(post.isLiked);
  const [likeCount, setLikeCount] = useState(post.likeCount);

  const handleLike = async () => {
    setLiked(!liked);
    setLikeCount(liked ? likeCount - 1 : likeCount + 1);
  };

  return (
    <div className={styles.feedItem}>
      <div className={styles.header}>
        <Avatar src={post.author.avatarUrl} />
        <span className={styles.username}>{post.author.username}</span>
      </div>
      <img src={post.imageUrl} alt={post.caption} className={styles.image} />
      <div className={styles.actions}>
        <LikeButton liked={liked} onLike={handleLike} />
        <CommentButton count={post.commentCount} />
        <ShareButton />
      </div>
      <p className={styles.caption}>{post.caption}</p>
    </div>
  );
};`,
  },
  {
    id: 'file-8',
    name: 'feed.hooks.ts',
    conceptId: 'feed',
    description: 'Custom React hooks for feed functionality. Manages feed state and data fetching.',
    exports: [
      { name: 'useFeed', whatItDoes: 'Hook that manages feed posts, loading state, and pagination' },
      { name: 'useInfiniteFeed', whatItDoes: 'Hook combining feed data with infinite scroll behavior' },
      { name: 'useFeedRefresh', whatItDoes: 'Hook providing pull-to-refresh functionality for the feed' },
    ],
    codeSnippet: `import { useState, useEffect, useCallback } from 'react';
import { FeedService } from './feed.service';
import { Post } from '../models/post.model';

const feedService = new FeedService();

export const useFeed = (userId: string) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [pageToken, setPageToken] = useState<string | undefined>();

  useEffect(() => {
    loadInitialFeed();
  }, [userId]);

  const loadInitialFeed = async () => {
    setIsLoading(true);
    const initialPosts = await feedService.getFollowingPosts(userId);
    setPosts(initialPosts);
    setIsLoading(false);
  };

  const loadMore = useCallback(async () => {
    const { posts: newPosts, nextPageToken } = await feedService.getPaginatedFeed(userId, pageToken);
    setPosts(prev => [...prev, ...newPosts]);
    setPageToken(nextPageToken);
    setHasMore(!!nextPageToken);
  }, [userId, pageToken]);

  return { posts, isLoading, hasMore, loadMore };
};`,
  },

  // Posts
  {
    id: 'file-9',
    name: 'post.model.ts',
    conceptId: 'posts',
    description: 'TypeScript models for post data structures. Defines interfaces for posts and related entities.',
    exports: [
      { name: 'Post', whatItDoes: 'Interface defining the shape of a post object' },
      { name: 'PostInput', whatItDoes: 'Interface for the data required to create a new post' },
      { name: 'Comment', whatItDoes: 'Interface defining the shape of a comment on a post' },
      { name: 'PostMetadata', whatItDoes: 'Interface for analytics data like views, saves, and shares' },
    ],
    codeSnippet: `export interface Post {
  id: string;
  authorId: string;
  author: {
    id: string;
    username: string;
    avatarUrl: string;
  };
  caption: string;
  imageUrl: string;
  imageUrls?: string[];
  createdAt: Date;
  updatedAt: Date;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  isLiked?: boolean;
  hashtags: string[];
  location?: string;
  comments?: Comment[];
}

export interface PostInput {
  caption: string;
  imageUrls: string[];
  hashtags?: string[];
  location?: string;
}

export interface Comment {
  id: string;
  authorId: string;
  author: { username: string; avatarUrl: string };
  text: string;
  createdAt: Date;
  likeCount: number;
}

export interface PostMetadata {
  viewCount: number;
  savesCount: number;
  sharesCount: number;
}`,
  },
  {
    id: 'file-10',
    name: 'post.service.ts',
    conceptId: 'posts',
    description: 'Service for post CRUD operations. Handles creating, updating, and deleting posts.',
    exports: [
      { name: 'PostService', whatItDoes: 'Service class providing all post CRUD and engagement operations' },
      { name: 'createPost', whatItDoes: 'Creates a new post with images, caption, and hashtags' },
      { name: 'updatePost', whatItDoes: 'Updates an existing post caption or metadata' },
      { name: 'deletePost', whatItDoes: 'Removes a post and its associated data' },
      { name: 'getPost', whatItDoes: 'Fetches a single post by its ID' },
    ],
    codeSnippet: `import { HttpClient } from '../http/client';
import { Post, PostInput } from './post.model';
import { MediaService } from '../media/media.service';

export class PostService {
  private baseUrl = '/api/posts';
  private mediaService = new MediaService();

  async createPost(userId: string, postInput: PostInput): Promise<Post> {
    const response = await HttpClient.post(\`\${this.baseUrl}\`, {
      ...postInput,
      authorId: userId,
      createdAt: new Date(),
    });
    return response.data;
  }

  async updatePost(postId: string, updates: Partial<PostInput>): Promise<Post> {
    const response = await HttpClient.put(\`\${this.baseUrl}/\${postId}\`, updates);
    return response.data;
  }

  async deletePost(postId: string): Promise<void> {
    await HttpClient.delete(\`\${this.baseUrl}/\${postId}\`);
  }

  async getPost(postId: string): Promise<Post> {
    const response = await HttpClient.get(\`\${this.baseUrl}/\${postId}\`);
    return response.data;
  }

  async likePost(postId: string, userId: string): Promise<void> {
    await HttpClient.post(\`\${this.baseUrl}/\${postId}/like\`, { userId });
  }

  async unlikePost(postId: string, userId: string): Promise<void> {
    await HttpClient.delete(\`\${this.baseUrl}/\${postId}/like?userId=\${userId}\`);
  }
}`,
  },
  {
    id: 'file-11',
    name: 'createPost.screen.tsx',
    conceptId: 'posts',
    description: 'Screen for creating new posts. Allows caption entry, image upload, and hashtag addition.',
    exports: [
      { name: 'CreatePostScreen', whatItDoes: 'Full-page form for composing and publishing a new post' },
      { name: 'PostEditor', whatItDoes: 'Reusable editor component for caption and hashtag input' },
    ],
    codeSnippet: `import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { PostService } from './post.service';
import { ImageUploader } from '../components/imageUploader';
import { TextInput, Button } from '../components/common';
import styles from './createPost.module.css';

export const CreatePostScreen: React.FC = () => {
  const { user } = useAuth();
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const postService = new PostService();

  const handlePostSubmit = async () => {
    if (!caption || imageUrls.length === 0) return;

    setIsPosting(true);
    try {
      await postService.createPost(user.id, {
        caption,
        imageUrls,
        hashtags,
      });
      setCaption('');
      setHashtags([]);
      setImageUrls([]);
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className={styles.container}>
      <h2>Create New Post</h2>
      <ImageUploader onUpload={setImageUrls} />
      <TextInput label="Caption" value={caption} onChange={setCaption} multiline />
      <TextInput label="Add hashtags (comma separated)" onChange={(val) => setHashtags(val.split(','))} />
      <Button onClick={handlePostSubmit} disabled={isPosting}>Post</Button>
    </div>
  );
};`,
  },
  {
    id: 'file-12',
    name: 'postCard.component.tsx',
    conceptId: 'posts',
    description: 'Reusable post card component. Displays post information in compact form.',
    exports: [
      { name: 'PostCard', whatItDoes: 'Compact card displaying a post thumbnail with engagement stats' },
      { name: 'PostCardSkeleton', whatItDoes: 'Loading placeholder matching PostCard dimensions' },
    ],
    codeSnippet: `import React from 'react';
import { Post } from './post.model';
import { Avatar } from '../components/avatar';
import { LikeButton, CommentButton } from '../components/interactions';
import styles from './postCard.module.css';

interface PostCardProps {
  post: Post;
  onClick?: () => void;
}

export const PostCard: React.FC<PostCardProps> = ({ post, onClick }) => {
  return (
    <div className={styles.card} onClick={onClick}>
      <div className={styles.cardHeader}>
        <Avatar src={post.author.avatarUrl} size="small" />
        <div className={styles.authorInfo}>
          <p className={styles.username}>{post.author.username}</p>
          <p className={styles.timestamp}>{formatTime(post.createdAt)}</p>
        </div>
      </div>
      <img src={post.imageUrl} alt="" className={styles.image} />
      <div className={styles.footer}>
        <span>{post.likeCount} likes</span>
        <span>{post.commentCount} comments</span>
      </div>
    </div>
  );
};

const formatTime = (date: Date) => {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return \`\${diffMins}m ago\`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return \`\${diffHours}h ago\`;
  return \`\${Math.floor(diffHours / 24)}d ago\`;
};`,
  },
  {
    id: 'file-13',
    name: 'comments.component.tsx',
    conceptId: 'posts',
    description: 'Component for displaying and managing post comments. Allows viewing and adding comments.',
    exports: [
      { name: 'CommentsSection', whatItDoes: 'Full comment thread with input field for adding new comments' },
      { name: 'CommentInput', whatItDoes: 'Text input component for writing and submitting a comment' },
      { name: 'CommentThread', whatItDoes: 'Renders a list of comments with author avatars and timestamps' },
    ],
    codeSnippet: `import React, { useState } from 'react';
import { Comment, Post } from './post.model';
import { Avatar } from '../components/avatar';
import { TextInput, Button } from '../components/common';
import styles from './comments.module.css';

interface CommentsSectionProps {
  post: Post;
  onAddComment: (text: string) => Promise<void>;
}

export const CommentsSection: React.FC<CommentsSectionProps> = ({ post, onAddComment }) => {
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    setIsLoading(true);
    try {
      await onAddComment(newComment);
      setNewComment('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.commentsSection}>
      <h3>Comments ({post.commentCount})</h3>
      <div className={styles.commentsList}>
        {post.comments?.map(comment => (
          <div key={comment.id} className={styles.comment}>
            <Avatar src={comment.author.avatarUrl} size="small" />
            <div className={styles.commentContent}>
              <strong>{comment.author.username}</strong>
              <p>{comment.text}</p>
            </div>
          </div>
        ))}
      </div>
      <div className={styles.commentInput}>
        <TextInput value={newComment} onChange={setNewComment} placeholder="Add a comment..." />
        <Button onClick={handleSubmit} disabled={isLoading}>Post</Button>
      </div>
    </div>
  );
};`,
  },

  // User Profiles
  {
    id: 'file-14',
    name: 'profile.screen.tsx',
    conceptId: 'profiles',
    description: 'User profile display screen. Shows user info, bio, posts grid, and follower stats.',
    exports: [
      { name: 'ProfileScreen', whatItDoes: 'Full profile page with avatar, stats, bio, and posts grid' },
      { name: 'ProfileHeader', whatItDoes: 'Top section of profile showing avatar and follower counts' },
    ],
    codeSnippet: `import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ProfileService } from './profile.service';
import { Avatar } from '../components/avatar';
import { Button } from '../components/common';
import styles from './profile.module.css';

interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  followerCount: number;
  followingCount: number;
  postsCount: number;
  isFollowing?: boolean;
}

export const ProfileScreen: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const profileService = new ProfileService();

  useEffect(() => {
    const loadProfile = async () => {
      const data = await profileService.getUserProfile(userId);
      setProfile(data);
      setIsLoading(false);
    };
    loadProfile();
  }, [userId]);

  if (isLoading || !profile) return <div>Loading...</div>;

  return (
    <div className={styles.profileContainer}>
      <div className={styles.header}>
        <Avatar src={profile.avatarUrl} size="large" />
        <div className={styles.info}>
          <h1>{profile.displayName}</h1>
          <p className={styles.username}>@{profile.username}</p>
          <p className={styles.bio}>{profile.bio}</p>
        </div>
      </div>
      <div className={styles.stats}>
        <div><strong>{profile.postsCount}</strong> Posts</div>
        <div><strong>{profile.followerCount}</strong> Followers</div>
        <div><strong>{profile.followingCount}</strong> Following</div>
      </div>
    </div>
  );
};`,
  },
  {
    id: 'file-15',
    name: 'profile.service.ts',
    conceptId: 'profiles',
    description: 'Service for profile-related API calls. Fetches and updates user profile data.',
    exports: [
      { name: 'ProfileService', whatItDoes: 'Service class for all user profile API operations' },
      { name: 'getUserProfile', whatItDoes: 'Fetches a user profile by ID including follower counts' },
      { name: 'updateProfile', whatItDoes: 'Updates user display name, bio, or avatar URL' },
      { name: 'followUser', whatItDoes: 'Creates a follow relationship between two users' },
    ],
    codeSnippet: `import { HttpClient } from '../http/client';

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  followerCount: number;
  followingCount: number;
  postsCount: number;
}

export class ProfileService {
  private baseUrl = '/api/users';

  async getUserProfile(userId: string): Promise<UserProfile> {
    const response = await HttpClient.get(\`\${this.baseUrl}/\${userId}\`);
    return response.data;
  }

  async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    const response = await HttpClient.put(\`\${this.baseUrl}/\${userId}\`, updates);
    return response.data;
  }

  async followUser(userId: string, targetUserId: string): Promise<void> {
    await HttpClient.post(\`\${this.baseUrl}/\${userId}/follow/\${targetUserId}\`, {});
  }

  async unfollowUser(userId: string, targetUserId: string): Promise<void> {
    await HttpClient.delete(\`\${this.baseUrl}/\${userId}/follow/\${targetUserId}\`);
  }

  async getUserPosts(userId: string, page: number = 1) {
    const response = await HttpClient.get(\`\${this.baseUrl}/\${userId}/posts?page=\${page}\`);
    return response.data;
  }
}`,
  },
  {
    id: 'file-16',
    name: 'editProfile.screen.tsx',
    conceptId: 'profiles',
    description: 'Screen for editing user profile information. Allows updating bio, avatar, and display name.',
    exports: [
      { name: 'EditProfileScreen', whatItDoes: 'Form screen for editing display name, bio, and avatar' },
    ],
    codeSnippet: `import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { ProfileService } from './profile.service';
import { TextInput, Button, ImageUploader } from '../components/common';
import styles from './editProfile.module.css';

export const EditProfileScreen: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [isSaving, setIsSaving] = useState(false);
  const profileService = new ProfileService();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = await profileService.updateProfile(user.id, {
        displayName,
        bio,
        avatarUrl,
      });
      updateUser(updated);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <h2>Edit Profile</h2>
      <ImageUploader onUpload={(urls) => setAvatarUrl(urls[0])} singleImage />
      <TextInput label="Display Name" value={displayName} onChange={setDisplayName} />
      <TextInput label="Bio" value={bio} onChange={setBio} multiline rows={4} />
      <Button onClick={handleSave} disabled={isSaving}>Save Changes</Button>
    </div>
  );
};`,
  },

  // Notifications
  {
    id: 'file-17',
    name: 'notifications.screen.tsx',
    conceptId: 'notifications',
    description: 'Notifications feed screen. Displays all user notifications with timestamps and actions.',
    exports: [
      { name: 'NotificationsScreen', whatItDoes: 'Full-page notification feed with grouped activity items' },
      { name: 'NotificationsList', whatItDoes: 'Scrollable list rendering individual notification entries' },
    ],
    codeSnippet: `import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { NotificationService } from './notification.service';
import { Avatar } from '../components/avatar';
import styles from './notifications.module.css';

interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'mention';
  actorUsername: string;
  actorAvatarUrl: string;
  targetId: string;
  message: string;
  createdAt: Date;
  isRead: boolean;
}

export const NotificationsScreen: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const notificationService = new NotificationService();

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    const data = await notificationService.getNotifications(user.id);
    setNotifications(data);
    setIsLoading(false);
  };

  return (
    <div className={styles.container}>
      <h1>Notifications</h1>
      <div className={styles.notificationsList}>
        {notifications.map(notification => (
          <div key={notification.id} className={styles.notification}>
            <Avatar src={notification.actorAvatarUrl} size="small" />
            <div className={styles.content}>
              <p><strong>{notification.actorUsername}</strong> {notification.message}</p>
              <span className={styles.time}>{formatTime(notification.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const formatTime = (date: Date) => {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return \`\${diffMins}m\`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return \`\${diffHours}h\`;
  return \`\${Math.floor(diffHours / 24)}d\`;
};`,
  },
  {
    id: 'file-18',
    name: 'notification.service.ts',
    conceptId: 'notifications',
    description: 'Service for notification management. Fetches, marks as read, and manages notification preferences.',
    exports: [
      { name: 'NotificationService', whatItDoes: 'Service class for fetching and managing user notifications' },
      { name: 'getNotifications', whatItDoes: 'Fetches all notifications for a given user ID' },
      { name: 'markAsRead', whatItDoes: 'Marks a single notification as read by its ID' },
      { name: 'deleteNotification', whatItDoes: 'Permanently removes a notification record' },
    ],
    codeSnippet: `import { HttpClient } from '../http/client';

export interface Notification {
  id: string;
  userId: string;
  type: string;
  actorId: string;
  targetId: string;
  message: string;
  createdAt: Date;
  isRead: boolean;
}

export class NotificationService {
  private baseUrl = '/api/notifications';

  async getNotifications(userId: string) {
    const response = await HttpClient.get(\`\${this.baseUrl}?userId=\${userId}\`);
    return response.data;
  }

  async markAsRead(notificationId: string): Promise<void> {
    await HttpClient.put(\`\${this.baseUrl}/\${notificationId}\`, { isRead: true });
  }

  async deleteNotification(notificationId: string): Promise<void> {
    await HttpClient.delete(\`\${this.baseUrl}/\${notificationId}\`);
  }

  async getUnreadCount(userId: string): Promise<number> {
    const response = await HttpClient.get(\`\${this.baseUrl}/unread-count?userId=\${userId}\`);
    return response.data.count;
  }

  async markAllAsRead(userId: string): Promise<void> {
    await HttpClient.put(\`\${this.baseUrl}/mark-all-read\`, { userId });
  }

  subscribeToNotifications(userId: string, callback: (notification: Notification) => void) {
    const eventSource = new EventSource(\`\${this.baseUrl}/subscribe?userId=\${userId}\`);
    eventSource.onmessage = (event) => callback(JSON.parse(event.data));
    return () => eventSource.close();
  }
}`,
  },
  {
    id: 'file-19',
    name: 'pushNotification.handler.ts',
    conceptId: 'notifications',
    description: 'Handles push notifications and WebSocket events. Manages real-time notification delivery.',
    exports: [
      { name: 'PushNotificationHandler', whatItDoes: 'Manages WebSocket connection for real-time push notifications' },
      { name: 'subscribeToPushNotifications', whatItDoes: 'Opens a persistent WebSocket channel for live alerts' },
      { name: 'sendPushNotification', whatItDoes: 'Delivers a desktop notification via the browser Notification API' },
    ],
    codeSnippet: `import { WebSocketClient } from '../websocket/client';
import { NotificationService } from './notification.service';

export class PushNotificationHandler {
  private wsClient: WebSocketClient;
  private notificationService: NotificationService;

  constructor(userId: string) {
    this.notificationService = new NotificationService();
    this.wsClient = new WebSocketClient(\`wss://api.example.com/ws?userId=\${userId}\`);
    this.setupListeners();
  }

  private setupListeners() {
    this.wsClient.on('notification', (data) => {
      this.handleIncomingNotification(data);
    });

    this.wsClient.on('like', (data) => {
      this.showDesktopNotification(\`\${data.actor} liked your post\`);
    });

    this.wsClient.on('comment', (data) => {
      this.showDesktopNotification(\`\${data.actor} commented on your post\`);
    });

    this.wsClient.on('follow', (data) => {
      this.showDesktopNotification(\`\${data.actor} started following you\`);
    });
  }

  private handleIncomingNotification(notification: any) {
    if (Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: notification.icon,
      });
    }
  }

  private showDesktopNotification(message: string) {
    if (Notification.permission === 'granted') {
      new Notification('Instagram', { body: message });
    }
  }

  public async requestPermission() {
    if ('Notification' in window) {
      return Notification.requestPermission();
    }
  }

  public disconnect() {
    this.wsClient.disconnect();
  }
}`,
  },

  // Media Storage
  {
    id: 'file-20',
    name: 'media.service.ts',
    conceptId: 'media',
    description: 'Service for media upload and retrieval. Handles image and video file operations.',
    exports: [
      { name: 'MediaService', whatItDoes: 'Service class for uploading, deleting, and optimizing media files' },
      { name: 'uploadImage', whatItDoes: 'Uploads an image file and returns the stored URL' },
      { name: 'uploadVideo', whatItDoes: 'Uploads a video file with a companion thumbnail image' },
      { name: 'deleteMedia', whatItDoes: 'Removes a media file from storage by its ID' },
      { name: 'generateThumbnail', whatItDoes: 'Creates a smaller preview image for a given media item' },
    ],
    codeSnippet: `import { HttpClient } from '../http/client';

export interface MediaUploadResponse {
  id: string;
  url: string;
  thumbnailUrl?: string;
  size: number;
  type: 'image' | 'video';
}

export class MediaService {
  private baseUrl = '/api/media';

  async uploadImage(file: File, userId: string): Promise<MediaUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', userId);

    return HttpClient.post(\`\${this.baseUrl}/upload\`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  async uploadVideo(file: File, userId: string, thumbnail: File): Promise<MediaUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('thumbnail', thumbnail);
    formData.append('userId', userId);

    return HttpClient.post(\`\${this.baseUrl}/upload/video\`, formData);
  }

  async deleteMedia(mediaId: string): Promise<void> {
    await HttpClient.delete(\`\${this.baseUrl}/\${mediaId}\`);
  }

  async generateThumbnail(mediaId: string): Promise<string> {
    const response = await HttpClient.post(\`\${this.baseUrl}/\${mediaId}/thumbnail\`, {});
    return response.data.thumbnailUrl;
  }

  async optimizeImage(mediaId: string, size: 'small' | 'medium' | 'large'): Promise<string> {
    const response = await HttpClient.get(\`\${this.baseUrl}/\${mediaId}/optimize?size=\${size}\`);
    return response.data.url;
  }
}`,
  },
  {
    id: 'file-21',
    name: 'imageUploader.component.tsx',
    conceptId: 'media',
    description: 'React component for image upload. Provides drag-drop and file selection interface.',
    exports: [
      { name: 'ImageUploader', whatItDoes: 'Drag-and-drop image upload component with file preview' },
      { name: 'useImageUpload', whatItDoes: 'Hook managing file selection, preview, and upload state' },
    ],
    codeSnippet: `import React, { useState, useRef } from 'react';
import { MediaService } from '../media/media.service';
import styles from './imageUploader.module.css';

interface ImageUploaderProps {
  onUpload: (urls: string[]) => void;
  singleImage?: boolean;
  maxFiles?: number;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  onUpload,
  singleImage = false,
  maxFiles = 10,
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaService = new MediaService();

  const handleFilesSelected = async (selectedFiles: FileList) => {
    const newFiles = Array.from(selectedFiles);
    if (singleImage) {
      setFiles([newFiles[0]]);
    } else {
      setFiles(prev => [...prev, ...newFiles].slice(0, maxFiles));
    }
  };

  const handleUpload = async () => {
    setIsUploading(true);
    try {
      const uploadedUrls = await Promise.all(
        files.map(file => mediaService.uploadImage(file, localStorage.getItem('userId')!))
      );
      onUpload(uploadedUrls.map(r => r.url));
      setFiles([]);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      className={styles.uploader}
      onDrop={(e) => { e.preventDefault(); handleFilesSelected(e.dataTransfer.files); }}
      onDragOver={(e) => e.preventDefault()}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple={!singleImage}
        accept="image/*"
        onChange={(e) => handleFilesSelected(e.target.files!)}
      />
      <p>Drag and drop images here or click to select</p>
      {files.length > 0 && <button onClick={handleUpload} disabled={isUploading}>Upload</button>}
    </div>
  );
};`,
  },
  {
    id: 'file-22',
    name: 'mediaCache.ts',
    conceptId: 'media',
    description: 'In-memory cache for media files and metadata. Reduces redundant network requests.',
    exports: [
      { name: 'MediaCache', whatItDoes: 'Singleton LRU cache for media metadata with TTL expiration' },
      { name: 'getCachedMedia', whatItDoes: 'Retrieves cached media metadata by ID if not expired' },
      { name: 'cacheMedia', whatItDoes: 'Stores media metadata in the cache with a timestamp' },
      { name: 'clearCache', whatItDoes: 'Removes all entries from the media cache' },
    ],
    codeSnippet: `interface CachedMedia {
  id: string;
  url: string;
  thumbnailUrl?: string;
  timestamp: number;
  accessCount: number;
}

export class MediaCache {
  private static instance: MediaCache;
  private cache = new Map<string, CachedMedia>();
  private readonly maxSize = 100;
  private readonly ttl = 3600000; // 1 hour

  private constructor() {}

  static getInstance(): MediaCache {
    if (!MediaCache.instance) {
      MediaCache.instance = new MediaCache();
    }
    return MediaCache.instance;
  }

  get(mediaId: string): CachedMedia | null {
    const item = this.cache.get(mediaId);
    if (!item) return null;

    const age = Date.now() - item.timestamp;
    if (age > this.ttl) {
      this.cache.delete(mediaId);
      return null;
    }

    item.accessCount++;
    return item;
  }

  set(mediaId: string, data: CachedMedia): void {
    if (this.cache.size >= this.maxSize) {
      const oldestKey = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
      this.cache.delete(oldestKey);
    }
    this.cache.set(mediaId, { ...data, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }

  getStats() {
    return {
      size: this.cache.size,
      items: Array.from(this.cache.values()),
    };
  }
}`,
  },

  // Search
  {
    id: 'file-23',
    name: 'search.screen.tsx',
    conceptId: 'search',
    description: 'Search interface screen. Allows users to search for posts, users, and hashtags.',
    exports: [
      { name: 'SearchScreen', whatItDoes: 'Full-page search interface with tabbed results and debounced input' },
      { name: 'SearchResults', whatItDoes: 'Component rendering grouped search results by content type' },
    ],
    codeSnippet: `import React, { useState, useEffect } from 'react';
import { SearchService } from './search.service';
import { TextInput, LoadingSpinner } from '../components/common';
import styles from './search.module.css';

interface SearchResult {
  type: 'post' | 'user' | 'hashtag';
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
}

export const SearchScreen: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'posts' | 'users' | 'hashtags'>('all');
  const searchService = new SearchService();

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      const searchResults = await searchService.search(query, activeTab);
      setResults(searchResults);
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, activeTab]);

  return (
    <div className={styles.container}>
      <TextInput
        placeholder="Search posts, people, hashtags..."
        value={query}
        onChange={setQuery}
        autoFocus
      />
      <div className={styles.tabs}>
        {['all', 'posts', 'users', 'hashtags'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab as any)} className={activeTab === tab ? styles.active : ''}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>
      {isLoading ? <LoadingSpinner /> : <SearchResults results={results} />}
    </div>
  );
};`,
  },
  {
    id: 'file-24',
    name: 'search.service.ts',
    conceptId: 'search',
    description: 'Search service with filtering and ranking. Provides fast search across posts and users.',
    exports: [
      { name: 'SearchService', whatItDoes: 'Service class handling search queries with recent search history' },
      { name: 'search', whatItDoes: 'Executes a search query with optional type filter' },
      { name: 'searchHashtags', whatItDoes: 'Searches specifically for hashtags matching a query' },
      { name: 'searchUsers', whatItDoes: 'Searches specifically for user profiles matching a query' },
    ],
    codeSnippet: `import { HttpClient } from '../http/client';

export interface SearchQuery {
  text: string;
  type?: 'posts' | 'users' | 'hashtags';
  limit?: number;
  offset?: number;
}

export class SearchService {
  private baseUrl = '/api/search';
  private recentSearches: string[] = [];

  async search(query: string, type: string = 'all') {
    const response = await HttpClient.get(\`\${this.baseUrl}\`, {
      params: { q: query, type, limit: 20 },
    });
    this.addRecentSearch(query);
    return response.data.results;
  }

  async searchUsers(query: string) {
    const response = await HttpClient.get(\`\${this.baseUrl}/users\`, {
      params: { q: query },
    });
    return response.data;
  }

  async searchPosts(query: string) {
    const response = await HttpClient.get(\`\${this.baseUrl}/posts\`, {
      params: { q: query },
    });
    return response.data;
  }

  async searchHashtags(query: string) {
    const response = await HttpClient.get(\`\${this.baseUrl}/hashtags\`, {
      params: { q: query },
    });
    return response.data;
  }

  addRecentSearch(query: string) {
    this.recentSearches = [query, ...this.recentSearches.filter(s => s !== query)].slice(0, 10);
    localStorage.setItem('recentSearches', JSON.stringify(this.recentSearches));
  }

  getRecentSearches() {
    return JSON.parse(localStorage.getItem('recentSearches') || '[]');
  }
}`,
  },
  {
    id: 'file-25',
    name: 'searchResults.component.tsx',
    conceptId: 'search',
    description: 'Displays search results in organized sections. Groups results by type.',
    exports: [
      { name: 'SearchResults', whatItDoes: 'Groups and renders search results by posts, users, and hashtags' },
      { name: 'ResultItem', whatItDoes: 'Renders a single search result row with image and text' },
    ],
    codeSnippet: `import React from 'react';
import { Avatar } from '../components/avatar';
import styles from './searchResults.module.css';

interface SearchResult {
  type: 'post' | 'user' | 'hashtag';
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  count?: number;
}

interface SearchResultsProps {
  results: SearchResult[];
}

export const SearchResults: React.FC<SearchResultsProps> = ({ results }) => {
  const grouped = {
    posts: results.filter(r => r.type === 'post'),
    users: results.filter(r => r.type === 'user'),
    hashtags: results.filter(r => r.type === 'hashtag'),
  };

  return (
    <div className={styles.results}>
      {grouped.posts.length > 0 && (
        <div className={styles.section}>
          <h3>Posts</h3>
          {grouped.posts.map(result => (
            <ResultItem key={result.id} result={result} />
          ))}
        </div>
      )}
      {grouped.users.length > 0 && (
        <div className={styles.section}>
          <h3>People</h3>
          {grouped.users.map(result => (
            <ResultItem key={result.id} result={result} />
          ))}
        </div>
      )}
      {grouped.hashtags.length > 0 && (
        <div className={styles.section}>
          <h3>Hashtags</h3>
          {grouped.hashtags.map(result => (
            <ResultItem key={result.id} result={result} />
          ))}
        </div>
      )}
    </div>
  );
};

const ResultItem: React.FC<{ result: SearchResult }> = ({ result }) => (
  <div className={styles.resultItem}>
    {result.imageUrl && <Avatar src={result.imageUrl} />}
    <div>
      <p className={styles.title}>{result.title}</p>
      {result.subtitle && <p className={styles.subtitle}>{result.subtitle}</p>}
    </div>
  </div>
);`,
  },

  // Database
  {
    id: 'file-26',
    name: 'database.config.ts',
    conceptId: 'database',
    description: 'Database configuration and connection setup. Initializes the database connection pool.',
    exports: [
      { name: 'DatabaseConfig', whatItDoes: 'Singleton class managing the PostgreSQL connection pool' },
      { name: 'getConnection', whatItDoes: 'Acquires a client connection from the pool' },
      { name: 'initializeDatabase', whatItDoes: 'Tests the database connection and logs success or failure' },
    ],
    codeSnippet: `import { Pool, PoolClient } from 'pg';

export class DatabaseConfig {
  private static instance: Pool;

  static getInstance(): Pool {
    if (!DatabaseConfig.instance) {
      DatabaseConfig.instance = new Pool({
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'instagram_clone',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      DatabaseConfig.instance.on('error', (err) => {
        console.error('Unexpected error on idle client', err);
      });
    }
    return DatabaseConfig.instance;
  }

  static async getConnection(): Promise<PoolClient> {
    return DatabaseConfig.getInstance().connect();
  }

  static async initialize() {
    const pool = DatabaseConfig.getInstance();
    const client = await pool.connect();
    try {
      await client.query('SELECT NOW()');
      console.log('Database connection successful');
    } finally {
      client.release();
    }
  }

  static async close() {
    await DatabaseConfig.instance.end();
  }
}`,
  },
  {
    id: 'file-27',
    name: 'migrations.ts',
    conceptId: 'database',
    description: 'Database schema migrations. Creates and manages database tables and indexes.',
    exports: [
      { name: 'runMigrations', whatItDoes: 'Executes all pending database migrations in sequence' },
      { name: 'migrate', whatItDoes: 'Applies a single migration to the database' },
      { name: 'rollback', whatItDoes: 'Reverts the most recently applied migration' },
    ],
    codeSnippet: `import { Pool } from 'pg';

export const migrations = [
  {
    id: '001',
    name: 'Create users table',
    up: async (pool: Pool) => {
      await pool.query(\`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(255) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          display_name VARCHAR(255),
          bio TEXT,
          avatar_url VARCHAR(500),
          follower_count INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      \`);
    },
  },
  {
    id: '002',
    name: 'Create posts table',
    up: async (pool: Pool) => {
      await pool.query(\`
        CREATE TABLE posts (
          id SERIAL PRIMARY KEY,
          author_id INT REFERENCES users(id),
          caption TEXT,
          image_url VARCHAR(500),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          like_count INT DEFAULT 0,
          comment_count INT DEFAULT 0
        )
      \`);
    },
  },
];

export async function runMigrations(pool: Pool) {
  for (const migration of migrations) {
    await migration.up(pool);
    console.log(\`Ran migration: \${migration.name}\`);
  }
}`,
  },
  {
    id: 'file-28',
    name: 'models.index.ts',
    conceptId: 'database',
    description: 'Central index for all database models. Exports model classes for database entities.',
    exports: [
      { name: 'User', whatItDoes: 'TypeScript interface defining the user database record shape' },
      { name: 'Post', whatItDoes: 'TypeScript interface defining the post database record shape' },
      { name: 'Comment', whatItDoes: 'TypeScript interface defining the comment database record shape' },
      { name: 'Like', whatItDoes: 'TypeScript interface defining the like database record shape' },
      { name: 'Follow', whatItDoes: 'TypeScript interface defining the follow relationship record shape' },
      { name: 'Notification', whatItDoes: 'TypeScript interface defining the notification database record shape' },
    ],
    codeSnippet: `export interface User {
  id: number;
  username: string;
  email: string;
  passwordHash: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  followerCount: number;
  followingCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Post {
  id: number;
  authorId: number;
  caption: string;
  imageUrl: string;
  createdAt: Date;
  updatedAt: Date;
  likeCount: number;
  commentCount: number;
}

export interface Comment {
  id: number;
  postId: number;
  authorId: number;
  text: string;
  createdAt: Date;
  likeCount: number;
}

export interface Like {
  id: number;
  userId: number;
  postId?: number;
  commentId?: number;
  createdAt: Date;
}

export interface Follow {
  id: number;
  followerId: number;
  followingId: number;
  createdAt: Date;
}

export interface Notification {
  id: number;
  userId: number;
  type: string;
  actorId: number;
  targetId: number;
  isRead: boolean;
  createdAt: Date;
}`,
  },

  // Email
  {
    id: 'file-29',
    name: 'email.service.ts',
    conceptId: 'email',
    description: 'Service for sending emails. Handles user verification, password reset, and notifications.',
    exports: [
      { name: 'EmailService', whatItDoes: 'Service class for sending transactional emails via SMTP' },
      { name: 'sendVerificationEmail', whatItDoes: 'Sends an account verification email with a tokenized link' },
      { name: 'sendPasswordResetEmail', whatItDoes: 'Sends a password reset email with a time-limited link' },
      { name: 'sendNotificationEmail', whatItDoes: 'Sends a general notification email with custom subject and body' },
    ],
    codeSnippet: `import nodemailer from 'nodemailer';
import { EmailTemplates } from './emailTemplates';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendVerificationEmail(email: string, token: string) {
    const html = EmailTemplates.verificationEmail(token);
    return this.transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: 'Verify your Instagram account',
      html,
    });
  }

  async sendPasswordResetEmail(email: string, resetToken: string) {
    const html = EmailTemplates.passwordResetEmail(resetToken);
    return this.transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: 'Reset your password',
      html,
    });
  }

  async sendNotificationEmail(email: string, subject: string, message: string) {
    return this.transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject,
      html: message,
    });
  }
}`,
  },
  {
    id: 'file-30',
    name: 'emailTemplates.ts',
    conceptId: 'email',
    description: 'HTML email templates for different notification types.',
    exports: [
      { name: 'EmailTemplates', whatItDoes: 'Static class providing HTML template generators for all email types' },
    ],
    codeSnippet: `export class EmailTemplates {
  static verificationEmail(token: string): string {
    return \`
      <html>
        <body style="font-family: Arial, sans-serif;">
          <h1>Welcome to Instagram!</h1>
          <p>Please verify your email address by clicking the link below:</p>
          <a href="\${process.env.APP_URL}/verify?token=\${token}" style="background: #0095F6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Verify Email
          </a>
          <p>This link expires in 24 hours.</p>
        </body>
      </html>
    \`;
  }

  static passwordResetEmail(token: string): string {
    return \`
      <html>
        <body style="font-family: Arial, sans-serif;">
          <h1>Reset Your Password</h1>
          <p>Click the link below to reset your password:</p>
          <a href="\${process.env.APP_URL}/reset-password?token=\${token}" style="background: #0095F6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Reset Password
          </a>
          <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
        </body>
      </html>
    \`;
  }

  static notificationEmail(username: string, action: string): string {
    return \`
      <html>
        <body style="font-family: Arial, sans-serif;">
          <h2>\${username} \${action}</h2>
          <p>Check it out on Instagram!</p>
        </body>
      </html>
    \`;
  }
}`,
  },
];

export const sampleEdges = [
  { source: 'auth', target: 'database', label: 'stores data in', explanation: 'Authentication stores user credentials, password hashes, and session records in the database. Every login attempt queries the users table to validate credentials.', strength: 'strong' },
  { source: 'feed', target: 'posts', label: 'depends on', explanation: 'The feed assembles its content by querying the posts table for entries from followed users, sorted by recency. Without posts, the feed has nothing to display.', strength: 'strong' },
  { source: 'feed', target: 'profiles', label: 'depends on', explanation: 'Each feed item displays the author profile information (username, avatar) alongside the post content. The feed fetches profile data to render post headers.', strength: 'moderate' },
  { source: 'posts', target: 'media', label: 'sends data to', explanation: 'When a user creates a post, the images are first uploaded through the media service, which returns URLs that are then stored on the post record.', strength: 'strong' },
  { source: 'posts', target: 'database', label: 'stores data in', explanation: 'All post data (captions, image URLs, hashtags, timestamps, engagement counts) is persisted in the posts table with foreign keys to the users table.', strength: 'strong' },
  { source: 'profiles', target: 'media', label: 'sends data to', explanation: 'Profile avatar uploads go through the media service for processing and storage. The returned URL is saved on the user profile record.', strength: 'moderate' },
  { source: 'profiles', target: 'database', label: 'stores data in', explanation: 'User profile information (display name, bio, avatar URL, follower counts) is stored in the users table and updated via profile edit operations.', strength: 'strong' },
  { source: 'notifications', target: 'posts', label: 'depends on', explanation: 'Notifications reference posts when someone likes, comments on, or shares a post. The notification includes a link back to the originating post.', strength: 'moderate' },
  { source: 'notifications', target: 'email', label: 'triggers', explanation: 'Important notifications (new followers, comment replies) can trigger email delivery for users who have email notifications enabled in their preferences.', strength: 'weak' },
  { source: 'notifications', target: 'database', label: 'stores data in', explanation: 'All notifications are persisted in the notifications table with type, actor, target, read status, and timestamp for the in-app notification feed.', strength: 'strong' },
  { source: 'auth', target: 'email', label: 'triggers', explanation: 'Authentication triggers emails during registration (verification email) and password reset flows (reset link email) to confirm user identity.', strength: 'moderate' },
  { source: 'search', target: 'posts', label: 'depends on', explanation: 'Search queries the posts table using full-text search on captions and hashtags to return matching post results ranked by relevance.', strength: 'moderate' },
  { source: 'search', target: 'profiles', label: 'depends on', explanation: 'User search queries the profiles data to find users by username or display name, returning matching profiles with avatars and follower counts.', strength: 'moderate' },
  { source: 'search', target: 'database', label: 'depends on', explanation: 'All search queries ultimately hit the database, leveraging full-text search indexes on posts and users tables for fast result retrieval.', strength: 'strong' },
  { source: 'media', target: 'database', label: 'stores metadata in', explanation: 'While the actual files are stored in object storage (S3), media metadata (file ID, URLs, size, type, upload timestamp) is stored in the database for lookups.', strength: 'moderate' },
];

export const sampleFileImports = [
  { source: 'file-3', target: 'file-2' }, // login.screen.tsx -> auth.service.ts
  { source: 'file-4', target: 'file-2' }, // register.screen.tsx -> auth.service.ts
  { source: 'file-1', target: 'file-2' }, // auth.controller.ts -> auth.service.ts
  { source: 'file-5', target: 'file-6' }, // feed.screen.tsx -> feed.service.ts
  { source: 'file-5', target: 'file-7' }, // feed.screen.tsx -> feedItem.component.tsx
  { source: 'file-5', target: 'file-8' }, // feed.screen.tsx -> feed.hooks.ts
  { source: 'file-8', target: 'file-6' }, // feed.hooks.ts -> feed.service.ts
  { source: 'file-11', target: 'file-10' }, // createPost.screen.tsx -> post.service.ts
  { source: 'file-11', target: 'file-21' }, // createPost.screen.tsx -> imageUploader.component.tsx
  { source: 'file-13', target: 'file-9' }, // comments.component.tsx -> post.model.ts
  { source: 'file-12', target: 'file-9' }, // postCard.component.tsx -> post.model.ts
  { source: 'file-14', target: 'file-15' }, // profile.screen.tsx -> profile.service.ts
  { source: 'file-16', target: 'file-15' }, // editProfile.screen.tsx -> profile.service.ts
  { source: 'file-21', target: 'file-20' }, // imageUploader.component.tsx -> media.service.ts
  { source: 'file-23', target: 'file-24' }, // search.screen.tsx -> search.service.ts
  { source: 'file-23', target: 'file-25' }, // search.screen.tsx -> searchResults.component.tsx
  { source: 'file-17', target: 'file-18' }, // notifications.screen.tsx -> notification.service.ts
  { source: 'file-17', target: 'file-19' }, // notifications.screen.tsx -> pushNotification.handler.ts
  { source: 'file-18', target: 'file-19' }, // notification.service.ts -> pushNotification.handler.ts
  { source: 'file-29', target: 'file-30' }, // email.service.ts -> emailTemplates.ts
];
