const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const Task = require('../models/Task');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static files
// Serve public assets first so references like /style.css, /Home.jpeg resolve
app.use(express.static(path.join(__dirname, '..', 'public')));

// Serve pages (HTML) at root so files like /halo.html and /register.html
app.use(express.static(path.join(__dirname, '..', 'pages')));

// Keep legacy path `/login/login.html` used by the SPA: serve the existing register.html
app.get('/login/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'pages', 'register.html'));
});

// Also map root to halo page to match original behavior
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'pages', 'halo.html'));
});

// DB connect
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true }).catch(err => console.error('Mongo error', err));

// Session (simple cookie-based)
const sessionStore = MongoStore.create({ mongoUrl: process.env.MONGO_URI });
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

// ===== Auth helpers =====
const bcrypt = require('bcrypt');

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hash });
    await user.save();
    req.session.userId = user._id;
    res.json({ ok: true, username: user.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to create user' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
  try {
    const user = await User.findOne({ username: username.toLowerCase().trim() });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    req.session.userId = user._id;
    res.json({ ok: true, username: user.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  const user = await User.findById(req.session.userId).lean();
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ username: user.username });
});

// ===== Tasks API =====
app.get('/api/tugas', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  const tasks = await Task.find({ owner: req.session.userId, completed: false }).lean();
  const completed = await Task.find({ owner: req.session.userId, completed: true }).lean();
  res.json({ tasks: tasks.map(t => ({ ...t, id: t._id })), completed: completed.map(t => ({ ...t, id: t._id })) });
});

app.post('/api/tugas', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  const { name, mapel, deadline, rating } = req.body;
  try {
    const t = new Task({ name, mapel, deadline, rating, owner: req.session.userId });
    await t.save();
    res.json({ task: { ...t.toObject(), id: t._id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Cannot create task' });
  }
});

app.post('/api/tugas/:id/complete', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  const id = req.params.id;
  try {
    await Task.updateOne({ _id: id, owner: req.session.userId }, { $set: { completed: true } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Cannot complete task' });
  }
});

module.exports = app;
