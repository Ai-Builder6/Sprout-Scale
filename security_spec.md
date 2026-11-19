# Security Specification — SproutScale

## 1. Data Invariants

1. **Verified Authentication Gate**: Every read and write operation requires an authenticated user (`request.auth != null`) with `request.auth.token.email_verified == true`.
2. **Strict Ownership Isolation**: A `ChildProfile` at `/children/{childId}` may only be created, read, listed, updated, or deleted by the user whose `request.auth.uid` matches `ownerId`.
3. **Master Gate Relational Integrity**: Subcollections `GrowthMeasurement` (`/children/{childId}/measurements/{measurementId}`), `ChildPhoto` (`/children/{childId}/photos/{photoId}`), and `MilestoneEvent` (`/children/{childId}/events/{eventId}`) cannot be created, read (`get`), updated, or deleted unless `/children/{childId}` exists and its `ownerId` matches `request.auth.uid`, AND the subcollection document's `childId` matches `{childId}` and `ownerId` matches `request.auth.uid`.
4. **Path Variable Hardening**: Every single-document path ID (`{childId}`, `{measurementId}`, `{photoId}`, `{eventId}`) must match `^[a-zA-Z0-9_\-]+$` and have length `1..128`.
5. **Temporal & Immutable Integrity**: `createdAt` and `updatedAt` must strictly equal `request.time` on creation; `ownerId`, `childId`, and `createdAt` are strictly immutable on update, while `updatedAt` must equal `request.time`.
6. **Volumetric & Domain Bounds (No Raw Images in Firestore)**:
   - `ChildProfile`: `name` (1..50 chars), optional `birthDate` (empty or `YYYY-MM-DD`, `<= 10` chars), optional `sex` in `['boy','girl','unspecified']` (`3..16` chars), `ageTwoHeightCm` (70..115), `ageTwoWeightKg` (8..25), `paletteId` in `['sunny','meadow','ocean','berry']`, `accessoryId` in `['none','sprout','cap','crown','dino']`, `hairStyle` in `['curls','bob','spiky','puffs']`, optional `skinTone` (`^#[0-9a-fA-F]{6}$`, 7 chars), optional `hairColor` (`^#[0-9a-fA-F]{6}$`, 7 chars), optional `avatarDriveFileId` (0..128 chars matching `^[a-zA-Z0-9_\-]+$`, strictly blocking raw data URLs or base64 blobs).
   - `GrowthMeasurement`: `ageMonths` (0..216), `heightCm` (45..210), `weightKg` (2.5..120), `recordedDate` matching `^[0-9]{4}-[0-9]{2}-[0-9]{2}$`, `note` (0..120 chars).
   - `ChildPhoto`: `kind` in `['avatar','wall','milestone','event','school','family']`, `capturedDate` matching `^[0-9]{4}-[0-9]{2}-[0-9]{2}$`, `ageMonths` (0..216), `heightCm` (0..210), `weightKg` (0..120), `caption` (0..240 chars), optional `eventTitle` (0..80 chars), optional `linkedMeasurementId` (0..128 chars matching `^[a-zA-Z0-9_\-]+$`), optional `isFavorite` (bool), `driveFileId` (0..128 chars matching `^[a-zA-Z0-9_\-]+$` when non-empty, strictly blocking raw base64/data URLs).
   - `MilestoneEvent`: `title` (1..80 chars), `category` in `['birthday','firsts','school','health','adventure','celebration']`, `eventDate` matching `^[0-9]{4}-[0-9]{2}-[0-9]{2}$`, `ageMonths` (0..216), `story` (0..400 chars), `heightCm` (0..210), `weightKg` (0..120), optional `linkedMeasurementId` & `linkedPhotoId` (0..128 chars matching `^[a-zA-Z0-9_\-]+$`).
7. **Zero Shadow Fields**: `hasAll` and `hasOnly` enforce exact schema keys on creation, and action-scoped `affectedKeys().hasOnly(...)` combined with full `isValid[Entity](incoming())` prevents update-gap and value-poisoning attacks.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Unverified Email Spoof**: Authenticated user with `email_verified: false` attempting to create `/children/child_1`.
2. **Identity Spoofing on Child Create**: `user_a` creates `/children/child_1` with `ownerId: "user_b"`.
3. **Shadow / Ghost Field Injection**: `user_a` creates `/children/child_1` or `/children/child_1/events/e_1` including unauthorized field `isAdmin: true`.
4. **ID Poisoning Attack**: `user_a` attempts to write to `/children/bad$id!with spaces` or >128 character ID.
5. **Orphaned Subcollection Write (Master Gate Bypass)**: `user_a` creates `/children/nonexistent_child/measurements/m_1`, `/photos/p_1`, or `/events/e_1`.
6. **Cross-Tenant Subcollection Injection**: `user_b` creates a measurement, photo, or event under `user_a`'s `/children/child_1/...` with `ownerId: "user_b"`.
7. **Update-Gap Value Poisoning / Raw Base64 Image Injection**: `user_a` attempts to store a base64 `data:image/jpeg;base64,...` string in `avatarDriveFileId`, `ChildPhoto.driveFileId`, or `MilestoneEvent.linkedPhotoId`.
8. **Immutable Field Mutation**: `user_a` updates `ownerId` or `createdAt` on `/children/child_1`, a photo record, or a milestone event.
9. **Client Timestamp Forgery**: `user_a` creates a measurement, photo, or event with a forged past/future `createdAt` instead of `serverTimestamp()` (`request.time`).
10. **Out-of-Bounds Biological / DOB / Story Values**: `user_a` logs `heightCm: 99999`, malformed `birthDate: "11/18/2022"`, or a 5,000-character `story` on an event.
11. **Path/Payload Mismatch**: `user_a` creates `/children/child_1/events/e_1` where payload `childId` is `"child_2"`.
12. **Blanket List Scraping Attack**: `user_b` executes an unfiltered `collection(db, 'children')` or `collection(db, 'children/child_alice/events')` list query without `where('ownerId', '==', 'user_b')`.

## 3. Red Team Audit Summary

- **Shadow Update Test**: PASS — `data.keys().hasOnly(...)` inside `isValidChildProfile`, `isValidGrowthMeasurement`, `isValidChildPhoto`, and `isValidMilestoneEvent` plus `affectedKeys().hasOnly(...)` in every update branch rejects any ghost key.
- **Email Spoofing Test**: PASS — `isVerifiedUser()` enforces `request.auth != null && request.auth.token.email_verified == true` across reads and writes.
- **PII / Image Bloating Guard**: PASS — Raw image bytes (`data:image/...`) are strictly rejected by `avatarDriveFileId`, `ChildPhoto.driveFileId`, and `linkedPhotoId` 128-char `^[a-zA-Z0-9_\-]+$` regexes, and `get`/`list` strictly require `ownerId == request.auth.uid`.
- **Query Trust Test**: PASS — `allow list` explicitly checks `resource.data.ownerId == request.auth.uid` (`existing().ownerId == request.auth.uid`) with zero `get()` calls inside `list`.
- **Conflict Report**:
  - Identity Spoofing: Blocked (`data.ownerId == request.auth.uid` + immutable check).
  - State Shortcutting: Blocked (strict action branches for child updates, measurement updates, photo gallery updates, and milestone event updates).
  - Resource Poisoning: Blocked (`isValidId` regex + `.size()` caps on every string).
  - Value Poisoning: Blocked (`isValidChildProfile`, `isValidGrowthMeasurement`, `isValidChildPhoto`, and `isValidMilestoneEvent` wrap every `allow update` block).
