// ============================================================
// College Event and Placement Management System - Backend
// Tech: Node.js + Express + MongoDB (Mongoose) + JWT Auth
// ============================================================

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();

// ─── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Connect to MongoDB ───────────────────────────────────────
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// ============================================================
// MONGOOSE MODELS
// ============================================================

// ─── User Model ───────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role:     { type: String, enum: ['admin', 'student'], default: 'student' },
  // Student-specific fields
  branch:   { type: String, default: '' },
  cgpa:     { type: Number, default: 0 },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// ─── Event Model ─────────────────────────────────────────────
const eventSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String, required: true },
  date:        { type: Date, required: true },
  venue:       { type: String, required: true },
  category:    { type: String, enum: ['Technical', 'Cultural', 'Sports', 'Workshop', 'Seminar', 'Other'], default: 'Other' },
  maxSeats:    { type: Number, default: 100 },
  registeredStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const Event = mongoose.model('Event', eventSchema);

// ─── Placement (Company) Model ────────────────────────────────
const placementSchema = new mongoose.Schema({
  companyName:  { type: String, required: true },
  jobRole:      { type: String, required: true },
  description:  { type: String, required: true },
  package:      { type: String, required: true }, // e.g. "8 LPA"
  eligibility: {
    minCGPA:    { type: Number, required: true },
    branches:   [{ type: String }],
    backlogsAllowed: { type: Boolean, default: false },
  },
  deadline:     { type: Date, required: true },
  driveDate:    { type: Date },
  status:       { type: String, enum: ['Open', 'Closed'], default: 'Open' },
  createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const Placement = mongoose.model('Placement', placementSchema);

// ─── Application Model ────────────────────────────────────────
const applicationSchema = new mongoose.Schema({
  student:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  placement:  { type: mongoose.Schema.Types.ObjectId, ref: 'Placement', required: true },
  status:     { type: String, enum: ['Applied', 'Shortlisted', 'Interview Scheduled', 'Selected', 'Rejected'], default: 'Applied' },
  appliedAt:  { type: Date, default: Date.now },
  notes:      { type: String, default: '' },
}, { timestamps: true });

const Application = mongoose.model('Application', applicationSchema);

// ============================================================
// JWT AUTH MIDDLEWARE
// ============================================================

const authMiddleware = (req, res, next) => {
  // Get token from Authorization header: "Bearer <token>"
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Access denied. No token provided.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role }
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid or expired token.' });
  }
};

// Admin-only middleware
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required.' });
  }
  next();
};

// ============================================================
// ROUTES: /api/auth
// ============================================================

// POST /api/auth/signup
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, role, branch, cgpa } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'Email already registered.' });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const user = new User({
      name, email,
      password: hashedPassword,
      role: role || 'student',
      branch: branch || '',
      cgpa: cgpa || 0,
    });

    await user.save();

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Account created successfully!',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, branch: user.branch, cgpa: user.cgpa }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid email or password.' });

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid email or password.' });

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful!',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, branch: user.branch, cgpa: user.cgpa }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/auth/me — Get logged-in user's profile
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/auth/users — Admin: get all users
app.get('/api/auth/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ============================================================
// ROUTES: /api/events
// ============================================================

// GET /api/events — Get all events (all authenticated users)
app.get('/api/events', authMiddleware, async (req, res) => {
  try {
    const events = await Event.find()
      .populate('createdBy', 'name')
      .sort({ date: 1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/events — Admin: Create event
app.post('/api/events', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { title, description, date, venue, category, maxSeats } = req.body;
    const event = new Event({
      title, description, date, venue, category, maxSeats,
      createdBy: req.user.id
    });
    await event.save();
    res.status(201).json({ message: 'Event created!', event });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/events/:id — Admin: Update event
app.put('/api/events/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    res.json({ message: 'Event updated!', event });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /api/events/:id — Admin: Delete event
app.delete('/api/events/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    res.json({ message: 'Event deleted!' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/events/:id/register — Student: Register for event
app.post('/api/events/:id/register', authMiddleware, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found.' });

    // Check if already registered
    if (event.registeredStudents.includes(req.user.id)) {
      return res.status(400).json({ message: 'Already registered for this event.' });
    }

    // Check seats
    if (event.registeredStudents.length >= event.maxSeats) {
      return res.status(400).json({ message: 'Event is full.' });
    }

    event.registeredStudents.push(req.user.id);
    await event.save();
    res.json({ message: 'Registered successfully!' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /api/events/:id/register — Student: Unregister from event
app.delete('/api/events/:id/register', authMiddleware, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found.' });

    event.registeredStudents = event.registeredStudents.filter(
      id => id.toString() !== req.user.id
    );
    await event.save();
    res.json({ message: 'Unregistered successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ============================================================
// ROUTES: /api/placements
// ============================================================

// GET /api/placements — Get all placements
app.get('/api/placements', authMiddleware, async (req, res) => {
  try {
    const placements = await Placement.find()
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });
    res.json(placements);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/placements — Admin: Add placement/company
app.post('/api/placements', authMiddleware, adminOnly, async (req, res) => {
  try {
    const placement = new Placement({ ...req.body, createdBy: req.user.id });
    await placement.save();
    res.status(201).json({ message: 'Placement opportunity added!', placement });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/placements/:id — Admin: Update placement
app.put('/api/placements/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const placement = await Placement.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!placement) return res.status(404).json({ message: 'Placement not found.' });
    res.json({ message: 'Placement updated!', placement });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /api/placements/:id — Admin: Delete placement
app.delete('/api/placements/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await Placement.findByIdAndDelete(req.params.id);
    // Also remove related applications
    await Application.deleteMany({ placement: req.params.id });
    res.json({ message: 'Placement deleted!' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ============================================================
// ROUTES: /api/applications
// ============================================================

// GET /api/applications — Get applications (student: own; admin: all)
app.get('/api/applications', authMiddleware, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'student') query.student = req.user.id;

    const applications = await Application.find(query)
      .populate('student', 'name email branch cgpa')
      .populate('placement', 'companyName jobRole package deadline status')
      .sort({ appliedAt: -1 });

    res.json(applications);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/applications — Student: Apply for placement
app.post('/api/applications', authMiddleware, async (req, res) => {
  try {
    const { placementId } = req.body;

    // Check if placement exists
    const placement = await Placement.findById(placementId);
    if (!placement) return res.status(404).json({ message: 'Placement not found.' });
    if (placement.status === 'Closed') return res.status(400).json({ message: 'Applications closed.' });

    // Check duplicate application
    const existing = await Application.findOne({ student: req.user.id, placement: placementId });
    if (existing) return res.status(400).json({ message: 'Already applied for this role.' });

    // Check eligibility
    const student = await User.findById(req.user.id);
    if (student.cgpa < placement.eligibility.minCGPA) {
      return res.status(400).json({
        message: `Minimum CGPA required: ${placement.eligibility.minCGPA}. Your CGPA: ${student.cgpa}`
      });
    }

    if (placement.eligibility.branches.length > 0 &&
        !placement.eligibility.branches.includes(student.branch)) {
      return res.status(400).json({
        message: `This role is only for: ${placement.eligibility.branches.join(', ')}`
      });
    }

    const application = new Application({
      student: req.user.id,
      placement: placementId,
    });
    await application.save();
    res.status(201).json({ message: 'Application submitted!', application });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/applications/:id/status — Admin: Update application status
app.put('/api/applications/:id/status', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { status, notes } = req.body;
    const application = await Application.findByIdAndUpdate(
      req.params.id,
      { status, notes },
      { new: true }
    ).populate('student', 'name email').populate('placement', 'companyName jobRole');

    if (!application) return res.status(404).json({ message: 'Application not found.' });
    res.json({ message: 'Status updated!', application });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/applications/stats — Admin: Dashboard stats
app.get('/api/applications/stats', authMiddleware, adminOnly, async (req, res) => {
  try {
    const totalStudents  = await User.countDocuments({ role: 'student' });
    const totalEvents    = await Event.countDocuments();
    const totalPlacements = await Placement.countDocuments();
    const totalApplications = await Application.countDocuments();
    const selectedCount  = await Application.countDocuments({ status: 'Selected' });

    res.json({ totalStudents, totalEvents, totalPlacements, totalApplications, selectedCount });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─── Start Server ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));