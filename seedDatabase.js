require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/bangdorms', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB (bangdorms)'))
.catch(err => console.error('Could not connect to MongoDB:', err));

// Define schemas
const dormSchema = new mongoose.Schema({
  name: String,
  location: String,
});

const roomSchema = new mongoose.Schema({
  dormId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dorm' },
  number: String,
  capacity: Number,
  currentStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
});

const studentSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  assignedRoom: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
});

// Create models
const Dorm = mongoose.model('Dorm', dormSchema);
const Room = mongoose.model('Room', roomSchema);
const Student = mongoose.model('Student', studentSchema);

// Seed data
async function seedDatabase() {
  // Clear existing data
  await Dorm.deleteMany({});
  await Room.deleteMany({});
  await Student.deleteMany({});

  // Create dorms
  const dorm1 = await Dorm.create({ name: 'Sunset Hall', location: 'West Campus' });
  const dorm2 = await Dorm.create({ name: 'Lakeside Dorm', location: 'East Campus' });

  // Create rooms
  const room1 = await Room.create({ dormId: dorm1._id, number: '101', capacity: 2 });
  const room2 = await Room.create({ dormId: dorm1._id, number: '102', capacity: 2 });
  const room3 = await Room.create({ dormId: dorm2._id, number: '201', capacity: 1 });
  const room4 = await Room.create({ dormId: dorm2._id, number: '202', capacity: 3 });

  // Create students
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('password123', salt);

  const student1 = await Student.create({ 
    name: 'John Doe', 
    email: 'john@example.com', 
    password: hashedPassword 
  });
  const student2 = await Student.create({ 
    name: 'Jane Smith', 
    email: 'jane@example.com', 
    password: hashedPassword 
  });

  // Assign some students to rooms
  room1.currentStudents.push(student1._id);
  await room1.save();
  student1.assignedRoom = room1._id;
  await student1.save();

  console.log('Database seeded successfully!');
  mongoose.connection.close();
}

seedDatabase();