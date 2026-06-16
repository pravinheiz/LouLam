import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Query } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

// Initialize Firebase Admin if environment variables are provided
if (process.env.FIREBASE_PROJECT_ID && !getApps().length) {
  try {
    if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
      });
      console.log("🔥 Connected to Firebase Firestore Admin SDK (via Service Account)");
    } else {
      initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID,
      });
      console.log("🔥 Connected to Firebase Firestore Admin SDK (via Public Project ID)");
    }
  } catch (error) {
    console.error("❌ Failed to initialize Firebase Admin SDK:", error);
  }
}

const firestore = (getApps().length && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) ? getFirestore() : null;

// Local JSON Document Store fallback setup
const MOCK_DB_DIR = path.resolve(process.cwd(), "scratch");
const MOCK_DB_PATH = path.join(MOCK_DB_DIR, "firebase-mock-db.json");

function ensureMockDb() {
  if (!fs.existsSync(MOCK_DB_DIR)) {
    fs.mkdirSync(MOCK_DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(MOCK_DB_PATH)) {
    fs.writeFileSync(
      MOCK_DB_PATH,
      JSON.stringify(
        {
          users: [],
          properties: [],
          propertyImages: [],
          propertyPolygons: [],
          messages: [],
          sellerVerifications: [],
          reports: [],
          auditLogs: [],
          otps: [],
        },
        null,
        2
      ),
      "utf8"
    );
  }
}

function readMockDb(): any {
  ensureMockDb();
  try {
    const data = fs.readFileSync(MOCK_DB_PATH, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading mock database:", err);
    return {
      users: [],
      properties: [],
      propertyImages: [],
      propertyPolygons: [],
      messages: [],
      sellerVerifications: [],
      reports: [],
      auditLogs: [],
    };
  }
}

function writeMockDb(data: any) {
  ensureMockDb();
  try {
    fs.writeFileSync(MOCK_DB_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing mock database:", err);
  }
}

// Helper to generate UUIDs locally
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Helper to resolve relationships if requested (Prisma-like select/include emulation)
async function resolveRelations(collectionName: string, item: any, options: any): Promise<any> {
  if (!item) return item;
  const result = { ...item };

  if (collectionName === "users") {
    // 1. Resolve sellerVerification
    if (options?.select?.sellerVerification || options?.include?.sellerVerification) {
      const sv = await db.sellerVerification.findFirst({ where: { userId: item.id } });
      result.sellerVerification = sv || null;
    }

    // 2. Resolve _count (e.g. properties)
    if (options?.select?._count || options?.include?._count) {
      const propertiesCount = await db.property.count({ where: { ownerId: item.id, deletedAt: null } });
      result._count = {
        properties: propertiesCount
      };
    }
  }

  if (collectionName === "properties") {
    // 1. Resolve images
    if (options?.select?.images || options?.include?.images) {
      const images = await db.propertyImage.findMany({ where: { propertyId: item.id } });
      const imgOptions = options?.select?.images || options?.include?.images;
      if (imgOptions?.orderBy) {
        const orderKey = Object.keys(imgOptions.orderBy)[0];
        const direction = imgOptions.orderBy[orderKey];
        images.sort((a: any, b: any) => {
          const valA = a[orderKey];
          const valB = b[orderKey];
          if (valA < valB) return direction === "asc" ? -1 : 1;
          if (valA > valB) return direction === "asc" ? 1 : -1;
          return 0;
        });
      }
      result.images = images;
    }

    // 2. Resolve owner
    if (options?.select?.owner || options?.include?.owner) {
      const owner = await db.user.findUnique({ where: { id: item.ownerId } });
      result.owner = owner || null;
    }
  }

  return result;
}

// Collection CRUD definitions mimicking Prisma Client
class FirestoreCollection<T extends { id?: string; [key: string]: any }> {
  constructor(private collectionName: string, private mockKey: string) {}

  private getRef() {
    return firestore ? firestore.collection(this.collectionName) : null;
  }

  async findUnique(options: { where: Record<string, any>; select?: any; include?: any; [key: string]: any }): Promise<T | null> {
    const ref = this.getRef();
    let item: T | null = null;
    if (ref) {
      const field = Object.keys(options.where)[0];
      const value = options.where[field];
      if (field === "id") {
        const doc = await ref.doc(value).get();
        item = doc.exists ? ({ id: doc.id, ...doc.data() } as unknown as T) : null;
      } else {
        const snapshot = await ref.where(field, "==", value).limit(1).get();
        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          item = { id: doc.id, ...doc.data() } as unknown as T;
        }
      }
    } else {
      const dbData = readMockDb();
      const list = dbData[this.mockKey] || [];
      const rawItem = list.find((x: any) =>
        Object.entries(options.where).every(([k, v]) => x[k] === v)
      );
      item = rawItem ? (JSON.parse(JSON.stringify(rawItem)) as unknown as T) : null;
    }
    return item ? await resolveRelations(this.collectionName, item, options) : null;
  }

  async findFirst(options: { where: Record<string, any>; select?: any; include?: any; [key: string]: any }): Promise<T | null> {
    return this.findUnique(options);
  }

  async findMany(options?: {
    where?: Record<string, any>;
    orderBy?: Record<string, "asc" | "desc">;
    take?: number;
    select?: any;
    include?: any;
    [key: string]: any;
  }): Promise<T[]> {
    const ref = this.getRef();
    let results: T[] = [];
    if (ref) {
      let query: Query = ref;
      if (options?.where) {
        for (const [k, v] of Object.entries(options.where)) {
          if (v !== undefined) {
            if (typeof v === "object" && v !== null && "not" in v) {
              query = query.where(k, "!=", v.not);
            } else {
              query = query.where(k, "==", v);
            }
          }
        }
      }
      
      const snapshot = await query.get();
      results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as unknown as T));

      if (options?.orderBy) {
        const orderKey = Object.keys(options.orderBy)[0];
        const direction = options.orderBy[orderKey];
        results.sort((a, b) => {
          const valA = a[orderKey];
          const valB = b[orderKey];
          if (valA < valB) return direction === "asc" ? -1 : 1;
          if (valA > valB) return direction === "asc" ? 1 : -1;
          return 0;
        });
      }

      if (options?.take) {
        results = results.slice(0, options.take);
      }
    } else {
      const dbData = readMockDb();
      let list: T[] = dbData[this.mockKey] || [];

      if (options?.where) {
        list = list.filter((item) =>
          Object.entries(options.where!).every(([k, v]) => {
            if (v === undefined) return true;
            if (typeof v === "object" && v !== null && "not" in v) {
              return item[k] !== v.not;
            }
            return item[k] === v;
          })
        );
      }

      if (options?.orderBy) {
        const orderKey = Object.keys(options.orderBy)[0];
        const direction = options.orderBy[orderKey];
        list.sort((a, b) => {
          const valA = a[orderKey];
          const valB = b[orderKey];
          if (valA < valB) return direction === "asc" ? -1 : 1;
          if (valA > valB) return direction === "asc" ? 1 : -1;
          return 0;
        });
      }

      if (options?.take) {
        list = list.slice(0, options.take);
      }

      results = JSON.parse(JSON.stringify(list));
    }
    
    return Promise.all(results.map(item => resolveRelations(this.collectionName, item, options)));
  }

  async create(options: { data: Record<string, any>; select?: any; include?: any; [key: string]: any }): Promise<T> {
    const id = options.data.id || generateUUID();
    const dataWithId = {
      ...options.data,
      id,
      createdAt: options.data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const ref = this.getRef();
    let result: T;
    if (ref) {
      await ref.doc(id).set(dataWithId);
      result = dataWithId as unknown as T;
    } else {
      const dbData = readMockDb();
      if (!dbData[this.mockKey]) dbData[this.mockKey] = [];
      dbData[this.mockKey].push(dataWithId);
      writeMockDb(dbData);
      result = JSON.parse(JSON.stringify(dataWithId)) as unknown as T;
    }
    return resolveRelations(this.collectionName, result, options);
  }

  async upsert(options: {
    where: Record<string, any>;
    update: Record<string, any>;
    create: Record<string, any>;
    select?: any;
    include?: any;
    [key: string]: any;
  }): Promise<T> {
    const existing = await this.findUnique({ where: options.where });
    if (existing) {
      return this.update({
        where: { id: existing.id },
        data: options.update,
        select: options.select,
        include: options.include,
      });
    } else {
      return this.create({
        data: options.create,
        select: options.select,
        include: options.include,
      });
    }
  }

  async update(options: {
    where: { id?: string; userId?: string };
    data: Record<string, any>;
    select?: any;
    include?: any;
    [key: string]: any;
  }): Promise<T> {
    const ref = this.getRef();
    const updateData = {
      ...options.data,
      updatedAt: new Date().toISOString(),
    };

    let result: T;
    if (ref) {
      let docId = options.where.id;
      if (!docId && options.where.userId) {
        const snapshot = await ref.where("userId", "==", options.where.userId).limit(1).get();
        if (!snapshot.empty) {
          docId = snapshot.docs[0].id;
        }
      }
      if (!docId) {
        throw new Error("Document to update not found");
      }

      await ref.doc(docId).update(updateData);
      const updatedDoc = await ref.doc(docId).get();
      result = { id: docId, ...updatedDoc.data() } as unknown as T;
    } else {
      const dbData = readMockDb();
      const list = dbData[this.mockKey] || [];
      const index = list.findIndex((x: any) =>
        options.where.id
          ? x.id === options.where.id
          : x.userId === options.where.userId
      );

      if (index === -1) {
        throw new Error("Document to update not found");
      }

      list[index] = {
        ...list[index],
        ...updateData,
      };
      dbData[this.mockKey] = list;
      writeMockDb(dbData);
      result = JSON.parse(JSON.stringify(list[index])) as unknown as T;
    }
    return resolveRelations(this.collectionName, result, options);
  }

  async delete(options: { where: { id: string }; select?: any; include?: any; [key: string]: any }): Promise<T> {
    const ref = this.getRef();
    let result: T;
    if (ref) {
      const doc = await ref.doc(options.where.id).get();
      if (!doc.exists) {
        throw new Error("Document to delete not found");
      }
      result = { id: doc.id, ...doc.data() } as unknown as T;
      await ref.doc(options.where.id).delete();
    } else {
      const dbData = readMockDb();
      const list = dbData[this.mockKey] || [];
      const index = list.findIndex((x: any) => x.id === options.where.id);
      if (index === -1) {
        throw new Error("Document to delete not found");
      }
      const [deletedItem] = list.splice(index, 1);
      dbData[this.mockKey] = list;
      writeMockDb(dbData);
      result = JSON.parse(JSON.stringify(deletedItem)) as unknown as T;
    }
    return resolveRelations(this.collectionName, result, options);
  }

  async deleteMany(options?: { where?: Record<string, any> }): Promise<{ count: number }> {
    const ref = this.getRef();
    if (ref) {
      let query: Query = ref;
      if (options?.where) {
        for (const [k, v] of Object.entries(options.where)) {
          query = query.where(k, "==", v);
        }
      }
      const snapshot = await query.get();
      const batch = ref.firestore.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      return { count: snapshot.size };
    } else {
      const db = readMockDb();
      let list = db[this.mockKey] || [];
      const initialCount = list.length;
      if (options?.where) {
        list = list.filter(
          (x: any) =>
            !Object.entries(options.where!).every(([k, v]) => x[k] === v)
        );
      } else {
        list = [];
      }
      db[this.mockKey] = list;
      writeMockDb(db);
      return { count: initialCount - list.length };
    }
  }

  async count(options?: { where?: Record<string, any> }): Promise<number> {
    const ref = this.getRef();
    if (ref) {
      let query: Query = ref;
      if (options?.where) {
        for (const [k, v] of Object.entries(options.where)) {
          if (v !== undefined) {
            query = query.where(k, "==", v);
          }
        }
      }
      const snapshot = await query.get();
      return snapshot.size;
    } else {
      const db = readMockDb();
      let list = db[this.mockKey] || [];
      if (options?.where) {
        list = list.filter((x: any) =>
          Object.entries(options.where!).every(([k, v]) => {
            if (v === undefined) return true;
            return x[k] === v;
          })
        );
      }
      return list.length;
    }
  }
}

export const db = {
  user: new FirestoreCollection<any>("users", "users"),
  property: new FirestoreCollection<any>("properties", "properties"),
  propertyImage: new FirestoreCollection<any>("propertyImages", "propertyImages"),
  propertyPolygon: new FirestoreCollection<any>("propertyPolygons", "propertyPolygons"),
  message: new FirestoreCollection<any>("messages", "messages"),
  sellerVerification: new FirestoreCollection<any>("sellerVerifications", "sellerVerifications"),
  report: new FirestoreCollection<any>("reports", "reports"),
  auditLog: new FirestoreCollection<any>("auditLogs", "auditLogs"),
  otp: new FirestoreCollection<any>("otps", "otps"),
};
