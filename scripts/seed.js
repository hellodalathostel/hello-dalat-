import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { initializeApp, cert } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

dotenv.config();

const { FIREBASE_SERVICE_ACCOUNT_PATH, FIREBASE_DATABASE_URL } = process.env;

if (!FIREBASE_SERVICE_ACCOUNT_PATH) {
  console.error('Missing FIREBASE_SERVICE_ACCOUNT_PATH in environment.');
  process.exit(1);
}

const serviceAccountPath = resolve(process.cwd(), FIREBASE_SERVICE_ACCOUNT_PATH);
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount),
  ...(FIREBASE_DATABASE_URL ? { databaseURL: FIREBASE_DATABASE_URL } : {})
});

const db = getFirestore();
const timestamp = FieldValue.serverTimestamp();
const defaultAmenities = [
  'private bathroom',
  'air conditioning',
  'hot water',
  'wifi'
];

const rooms = [
  {
    id: 'room_101',
    number: '101',
    type: 'family',
    typeLabel: 'Family Room',
    bedConfig: '2 beds',
    capacity: 4,
    floor: 1
  },
  {
    id: 'room_102',
    number: '102',
    type: 'single',
    typeLabel: 'Single Room',
    bedConfig: '1.4m bed',
    capacity: 1,
    floor: 1
  },
  {
    id: 'room_103',
    number: '103',
    type: 'deluxe_double',
    typeLabel: 'Deluxe Double',
    bedConfig: '1.6m bed',
    capacity: 2,
    floor: 1
  },
  {
    id: 'room_201',
    number: '201',
    type: 'deluxe_queen',
    typeLabel: 'Deluxe Queen',
    bedConfig: '2m x 2m bed',
    capacity: 2,
    floor: 2
  },
  {
    id: 'room_202',
    number: '202',
    type: 'single',
    typeLabel: 'Single Room',
    bedConfig: '1.4m bed',
    capacity: 1,
    floor: 2
  },
  {
    id: 'room_203',
    number: '203',
    type: 'deluxe_double',
    typeLabel: 'Deluxe Double',
    bedConfig: '1.6m bed',
    capacity: 2,
    floor: 2
  },
  {
    id: 'room_301',
    number: '301',
    type: 'standard_double',
    typeLabel: 'Standard Double',
    bedConfig: '1.6m bed',
    capacity: 2,
    floor: 3
  },
  {
    id: 'room_302',
    number: '302',
    type: 'standard_double',
    typeLabel: 'Standard Double',
    bedConfig: '1.6m bed',
    capacity: 2,
    floor: 3
  }
];

const financeCategories = {
  income: [
    { key: 'room', label: 'Tiền phòng' },
    { key: 'breakfast', label: 'Breakfast' },
    { key: 'scooter', label: 'Thuê xe máy' },
    { key: 'service', label: 'Dịch vụ thêm' },
    { key: 'other', label: 'Thu khác' }
  ],
  expense: [
    { key: 'utilities', label: 'Điện nước' },
    { key: 'supplies', label: 'Vật tư / vệ sinh' },
    { key: 'salary', label: 'Lương nhân viên' },
    { key: 'maintenance', label: 'Sửa chữa' },
    { key: 'marketing', label: 'Marketing' },
    { key: 'tax', label: 'Thuế / phí' },
    { key: 'other', label: 'Chi khác' }
  ]
};

const mainConfig = {
  name: 'Hello Dalat Hostel',
  address: '18/2 Hẻm 33 Phan Đình Phùng, Phường 1, Đà Lạt',
  phone: '+84 969 975 935',
  email: 'hellodalathostel@gmail.com',
  taxId: '068060000252',
  wifi: {
    network: 'HelloDalat',
    password: 'hellodalat'
  },
  banking: {
    bank: 'Vietcombank',
    accountHolder: 'Nguyễn Thanh Hiếu',
    accountNumber: '',
    bin: '970436'
  },
  checkInTime: '14:00',
  checkOutTime: '12:00',
  quietHoursFrom: '22:00',
  breakfast: {
    complimentaryForBookingCom: true,
    pricePerPerson: 35000,
    servedFrom: '07:00',
    servedUntil: '09:30'
  },
  googleMaps: 'https://maps.app.goo.gl/9Bc9d8LBcbr86XaUA'
};

async function seed() {
  console.log('🛏 Seeding rooms...');

  const batch = db.batch();

  for (const room of rooms) {
    const roomRef = db.collection('rooms').doc(room.id);
    batch.set(roomRef, {
      number: room.number,
      type: room.type,
      typeLabel: room.typeLabel,
      bedConfig: room.bedConfig,
      capacity: room.capacity,
      floor: room.floor,
      icalUrl: null,
      amenities: defaultAmenities,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp
    }, { merge: true });
  }

  console.log('🏠 Seeding hostel configuration...');
  batch.set(db.collection('config').doc('main'), mainConfig, { merge: true });

  console.log('💰 Seeding finance categories...');
  batch.set(db.collection('config').doc('finance_categories'), financeCategories, { merge: true });

  await batch.commit();
  console.log('✅ Firestore seed completed successfully.');
}

seed()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });