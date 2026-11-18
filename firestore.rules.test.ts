import {
  assertFails,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import fs from 'fs';

/**
 * Security TDD suite verifying all Dirty Dozen adversarial payloads
 * return PERMISSION_DENIED against firestore.rules.
 */
export async function runDirtyDozenSecuritySuite() {
  const testEnv: RulesTestEnvironment = await initializeTestEnvironment({
    projectId: 'sproutscale-security-test',
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8'),
    },
  });

  try {
    const aliceCtx = testEnv.authenticatedContext('user_alice', {
      email: 'alice@example.com',
      email_verified: true,
    });
    const unverifiedCtx = testEnv.authenticatedContext('user_unverified', {
      email: 'alice@example.com',
      email_verified: false,
    });
    const bobCtx = testEnv.authenticatedContext('user_bob', {
      email: 'bob@example.com',
      email_verified: true,
    });

    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      const adminDb = adminCtx.firestore();
      await setDoc(doc(adminDb, 'children', 'child_alice'), {
        ownerId: 'user_alice',
        name: 'Leo',
        birthDate: '2020-11-18',
        ageTwoHeightCm: 86.5,
        ageTwoWeightKg: 12.5,
        paletteId: 'meadow',
        accessoryId: 'sprout',
        hairStyle: 'curls',
        skinTone: '#f1c29b',
        hairColor: '#4a2e1b',
        avatarDriveFileId: '',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    });

    const aliceDb = aliceCtx.firestore();
    const bobDb = bobCtx.firestore();
    const unverifiedDb = unverifiedCtx.firestore();

    // 1. Unverified Email Spoof
    await assertFails(
      setDoc(doc(unverifiedDb, 'children', 'child_spoof'), {
        ownerId: 'user_unverified',
        name: 'Mia',
        ageTwoHeightCm: 86,
        ageTwoWeightKg: 12,
        paletteId: 'sunny',
        accessoryId: 'sprout',
        hairStyle: 'bob',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    // 2. Identity Spoofing on Child Create
    await assertFails(
      setDoc(doc(aliceDb, 'children', 'child_2'), {
        ownerId: 'user_bob',
        name: 'Mia',
        ageTwoHeightCm: 86,
        ageTwoWeightKg: 12,
        paletteId: 'sunny',
        accessoryId: 'sprout',
        hairStyle: 'bob',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    // 3. Shadow / Ghost Field Injection
    await assertFails(
      setDoc(doc(aliceDb, 'children', 'child_3'), {
        ownerId: 'user_alice',
        name: 'Mia',
        ageTwoHeightCm: 86,
        ageTwoWeightKg: 12,
        paletteId: 'sunny',
        accessoryId: 'sprout',
        hairStyle: 'bob',
        isAdmin: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    // 4. ID Poisoning Attack
    await assertFails(
      setDoc(doc(aliceDb, 'children', 'bad$id!spaces'), {
        ownerId: 'user_alice',
        name: 'Mia',
        ageTwoHeightCm: 86,
        ageTwoWeightKg: 12,
        paletteId: 'sunny',
        accessoryId: 'sprout',
        hairStyle: 'bob',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    // 5. Orphaned Subcollection Write (Master Gate Bypass)
    await assertFails(
      setDoc(doc(aliceDb, 'children', 'missing_child', 'measurements', 'm_1'), {
        ownerId: 'user_alice',
        childId: 'missing_child',
        ageMonths: 36,
        heightCm: 95,
        weightKg: 14.5,
        recordedDate: '2026-11-18',
        note: 'Checkup',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    // 6. Cross-Tenant Subcollection Injection
    await assertFails(
      setDoc(doc(bobDb, 'children', 'child_alice', 'measurements', 'm_2'), {
        ownerId: 'user_bob',
        childId: 'child_alice',
        ageMonths: 36,
        heightCm: 95,
        weightKg: 14.5,
        recordedDate: '2026-11-18',
        note: 'Intrusion',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    // 7. Update-Gap / Raw Base64 Image Injection into avatarDriveFileId
    await assertFails(
      updateDoc(doc(aliceDb, 'children', 'child_alice'), {
        avatarDriveFileId: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD',
        updatedAt: serverTimestamp(),
      }),
    );

    // 8. Immutable Field Mutation
    await assertFails(
      updateDoc(doc(aliceDb, 'children', 'child_alice'), {
        ownerId: 'user_bob',
        updatedAt: serverTimestamp(),
      }),
    );

    // 9. Client Timestamp Forgery
    await assertFails(
      setDoc(doc(aliceDb, 'children', 'child_alice', 'measurements', 'm_forged'), {
        ownerId: 'user_alice',
        childId: 'child_alice',
        ageMonths: 36,
        heightCm: 95,
        weightKg: 14.5,
        recordedDate: '2026-11-18',
        note: 'Forged time',
        createdAt: Timestamp.fromMillis(1000000),
        updatedAt: Timestamp.fromMillis(1000000),
      }),
    );

    // 10. Malformed Date of Birth / Invalid WHO Sex Enum / Out-of-Bounds Biological Values
    await assertFails(
      updateDoc(doc(aliceDb, 'children', 'child_alice'), {
        birthDate: '11/18/2020',
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(aliceDb, 'children', 'child_alice'), {
        sex: 'invalid_enum_value',
        updatedAt: serverTimestamp(),
      }),
    );

    // 11. Path/Payload Mismatch
    await assertFails(
      setDoc(doc(aliceDb, 'children', 'child_alice', 'measurements', 'm_mismatch'), {
        ownerId: 'user_alice',
        childId: 'other_child',
        ageMonths: 36,
        heightCm: 95,
        weightKg: 14.5,
        recordedDate: '2026-11-18',
        note: 'Mismatch',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    // 12. Blanket List Scraping Attack
    await assertFails(getDocs(collection(bobDb, 'children')));

    // 13. ChildPhoto Raw Base64 Injection & Cross-Tenant Photo Write
    await assertFails(
      setDoc(doc(aliceDb, 'children', 'child_alice', 'photos', 'p_raw_base64'), {
        ownerId: 'user_alice',
        childId: 'child_alice',
        kind: 'wall',
        capturedDate: '2026-11-18',
        ageMonths: 48,
        heightCm: 103.0,
        weightKg: 16.5,
        caption: 'Wall check-in',
        driveFileId: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      setDoc(doc(bobDb, 'children', 'child_alice', 'photos', 'p_cross_tenant'), {
        ownerId: 'user_bob',
        childId: 'child_alice',
        kind: 'avatar',
        capturedDate: '2026-11-18',
        ageMonths: 48,
        heightCm: 103.0,
        weightKg: 16.5,
        caption: 'Intrusion',
        driveFileId: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  } finally {
    await testEnv.cleanup();
  }
}
