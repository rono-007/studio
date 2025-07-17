
"use client";

import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';

export type ModelUsage = {
  [modelId: string]: number;
};

type UserUsageData = {
  lastReset: string; // YYYY-MM-DD
  usage: ModelUsage;
};

const getTodayDateString = () => new Date().toISOString().split('T')[0];

/**
 * Fetches the user's model usage from Firestore.
 * Handles daily reset logic.
 */
export const getModelUsage = async (userId: string): Promise<ModelUsage> => {
  const userUsageDocRef = doc(db, 'userUsage', userId);
  const docSnap = await getDoc(userUsageDocRef);
  const today = getTodayDateString();

  if (docSnap.exists()) {
    const data = docSnap.data() as UserUsageData;
    // Check if the usage needs to be reset
    if (data.lastReset !== today) {
      // Reset the usage for the new day
      const newUsageData: UserUsageData = {
        lastReset: today,
        usage: {},
      };
      await setDoc(userUsageDocRef, newUsageData);
      return newUsageData.usage;
    }
    return data.usage || {};
  } else {
    // No previous usage data, create new document
    const newUsageData: UserUsageData = {
      lastReset: today,
      usage: {},
    };
    await setDoc(userUsageDocRef, newUsageData);
    return newUsageData.usage;
  }
};

/**
 * Updates the user's model usage in Firestore.
 */
export const updateModelUsage = async (userId: string, modelId: string): Promise<void> => {
  const userUsageDocRef = doc(db, 'userUsage', userId);
  const today = getTodayDateString();

  const docSnap = await getDoc(userUsageDocRef);

  if (!docSnap.exists() || (docSnap.data() as UserUsageData).lastReset !== today) {
    // If doc doesn't exist or it's a new day, reset and then increment
     await setDoc(userUsageDocRef, {
      lastReset: today,
      usage: { [modelId]: 1 },
    });
  } else {
     // Otherwise, just increment the specific model's usage
    await updateDoc(userUsageDocRef, {
      [`usage.${modelId}`]: increment(1),
    });
  }
};
