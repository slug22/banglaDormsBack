require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
const corsOptions = {
  origin: 'http://localhost:8081', // Update this to match your React Native web app's URL
  optionsSuccessStatus: 200,
  credentials: true
};

app.use(cors(corsOptions));

// Body parser middleware
app.use(express.json());

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: false, // set to true if your app is on https
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());
// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/bangdorms', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB (bangdorms)'))
.catch(err => console.error('Could not connect to MongoDB:', err));

// Define schemas and models
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

const Dorm = mongoose.model('Dorm', dormSchema);
const Room = mongoose.model('Room', roomSchema);
const Student = mongoose.model('Student', studentSchema);

// Passport local strategy
passport.use(new LocalStrategy({ usernameField: 'email' },
  async (email, password, done) => {
    try {
      const student = await Student.findOne({ email });
      if (!student) {
        return done(null, false, { message: 'Incorrect email.' });
      }
      const isValidPassword = await bcrypt.compare(password, student.password);
      if (!isValidPassword) {
        return done(null, false, { message: 'Incorrect password.' });
      }
      return done(null, student);
    } catch (err) {
      return done(err);
    }
  }
));

passport.serializeUser((student, done) => {
  done(null, student.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const student = await Student.findById(id);
    done(null, student);
  } catch (err) {
    done(err);
  }
});

// Authentication routes
app.post('/login', passport.authenticate('local'), (req, res) => {
    console.log('Login successful, session:', req.session);
    res.json({ message: 'Logged in successfully', student: req.user });
  });
  
  // Middleware to check if user is authenticated
  const isAuthenticated = (req, res, next) => {
    console.log('Session:', req.session);
    console.log('User:', req.user);
    console.log('Is authenticated:', req.isAuthenticated());
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: 'Unauthorized' });
  };

app.post('/logout', (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: 'Error logging out' });
      }
      res.json({ message: 'Logged out successfully' });
    });
  });
  
// Routes
app.get('/dorms', async (req, res) => {
  try {
    const dorms = await Dorm.find();
    res.json(dorms);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/dorms/:dormId/rooms', async (req, res) => {
    try {
      const rooms = await Room.find({ dormId: req.params.dormId })
        .populate('currentStudents', 'name');
      res.json(rooms);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });
  

app.post('/rooms/unassign', isAuthenticated, async (req, res) => {
    try {
      const student = req.user;
  
      if (!student.assignedRoom) {
        return res.status(400).json({ message: 'You are not currently assigned to any room' });
      }
  
      const room = await Room.findById(student.assignedRoom);
      if (!room) {
        return res.status(404).json({ message: 'Assigned room not found' });
      }
  
      // Remove student from the room
      room.currentStudents = room.currentStudents.filter(id => !id.equals(student._id));
      await room.save();
  
      // Update student's assigned room to null
      student.assignedRoom = null;
      await student.save();
  
      res.json({ message: 'Successfully unassigned from the room' });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });
  
  // Modify the existing assign route to handle reassignments
  app.post('/rooms/:roomId/assign', isAuthenticated, async (req, res) => {
    console.log('User:', req.user);
    try {
      const room = await Room.findById(req.params.roomId);
      const student = req.user;
  
      if (!room) {
        return res.status(404).json({ message: 'Room not found' });
      }
  
      if (room.currentStudents.length >= room.capacity) {
        return res.status(400).json({ message: 'Room is already full' });
      }
  
      // If student is already assigned to a room, unassign them first
      if (student.assignedRoom) {
        const oldRoom = await Room.findById(student.assignedRoom);
        if (oldRoom) {
          oldRoom.currentStudents = oldRoom.currentStudents.filter(id => !id.equals(student._id));
          await oldRoom.save();
        }
      }
  
      room.currentStudents.push(student._id);
      await room.save();
  
      student.assignedRoom = room._id;
      await student.save();
  
      res.json({ message: 'Room assigned successfully' });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });
  
  // Add this new route to get the current user's information
  app.get('/user', isAuthenticated, (req, res) => {
    res.json({ user: req.user });
  });
  
app.get('/check-auth', (req, res) => {
    if (req.isAuthenticated()) {
      res.json({ isAuthenticated: true, user: req.user });
    } else {
      res.json({ isAuthenticated: false });
    }
  });
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});