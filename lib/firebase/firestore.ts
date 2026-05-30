"use client";

import { getFirestore, type Firestore } from "firebase/firestore";
import { getFirebaseApp } from "./config";

let _db: Firestore | undefined;

export function getFirebaseFirestore(): Firestore {
  if (!_db) _db = getFirestore(getFirebaseApp());
  return _db;
}
