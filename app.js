const express = require('express');
const mysql = require('mysql');
const session = require('express-session');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');


const app = express();
const PORT = process.env.PORT || 8000;


app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
}));
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '08420',
  database: 'blog',
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL');
});

// Middleware
const customStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Set the destination directory to the "uploads" directory in your project
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    // Use the original file name for the uploaded file
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: customStorage });

// Serve the login form
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Serve the registration form
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// Register a new user
app.post('/register', (req, res) => {
  const { username, password,email } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);

  db.query('INSERT INTO userprofile (uname, uemail, upass) VALUES (?, ?, ?)', [username,email, hashedPassword], (error, results) => {
    if (error) {
      console.error('Error registering user:', error);
      res.status(500).json({ message: 'Error registering user.' });
    } else {
      res.status(201).json({ message: 'User registered successfully.' });
    }
  });
});

// Login route
app.post('/', (req, res) => {
  
  // if (req.session && req.session.user) {
  //   req.session.destroy((err) => {
  //     if (err) {
  //       console.error('Error destroying session:', err);
  //     }
  //   });
  // }
  const { username, password } = req.body;

  db.query('SELECT * FROM userprofile WHERE uname = ?', [username], (error, results) => {
    if (error) {
      console.error('Error retrieving user:', error);
      res.status(500).json({ message: 'Error retrieving user.' });
    } else if (results.length === 0 || !bcrypt.compareSync(password, results[0].upass)) {
      res.status(401).json({ message: 'Invalid username or password.' });
    } else {
      const user = {
        id: results[0].uid,
        username: results[0].uname,
      };

      // Store user information in the session
      req.session.user = user;

      res.status(200).json(user);

      // Redirect to the home page after successful login
    
  }
  });
});

// Protected route
app.get('/userprofile', (req, res) => {
  const user = req.session.user;
  if (!user) {
    // User is not authenticated, redirect to login page
    res.redirect('/');
    return;
  }
  
  // Fetch the user's profile image from the database
  db.query('SELECT uimg FROM userprofile WHERE uid = ?', [user.id], (error, results) => {
    if (error) {
      console.error('Error fetching profile image:', error);
      return res.status(500).json({ message: 'Error fetching profile image.' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'Profile image not found.' });
    }

    // Assuming results[0].uimg contains the image data (make sure it's a valid URL or base64 data)
    const userImageBuffer = results[0].uimg;
    const userImageBase64 = userImageBuffer.toString('base64');

    // Create a data URI
    const userImageDataUri = `data:image/jpeg;base64,${userImageBase64}`;

    // Read the HTML file
    const fs = require('fs');
    const profileHtml = fs.readFileSync(path.join(__dirname, 'public', 'profile.html'), 'utf8');

    // Replace the placeholders in the HTML file
    const updatedHtml = profileHtml
      .replace('${user.username}', user.username)
      .replace('${user.image}', userImageDataUri); // Use a placeholder like ${user.image} in your HTML

    // Send the updated HTML content as the response
    res.send(updatedHtml);
  });
});

app.post('/userprofile',upload.single('image'),(req, res) => {
  const user = req.session.user;
  const image = req.file;
  console.log(image)
  if (!user) {
    // User is not authenticated, redirect to login page
    res.redirect('/');
    return;
  }
  if (!image) {
    return res.status(400).json({ message: 'Image data is missing.' });
  }
  const fs = require('fs');
  const imageData = fs.readFileSync(image.path);
  // Update the user's profile image in the database
  db.query('UPDATE userprofile SET uimg = ? WHERE uid = ?', [imageData, user.id], (error, results) => {
    if (error) {
      console.error('Error uploading image:', error);
      return res.status(500).json({ message: 'Error uploading image.' });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Successfully updated the profile image
    res.status(200).json({ message: 'Profile image updated successfully.' });
  });
});

 
// Serve the home.html file for the /home route
app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});
app.post('/createblog', (req, res) => {
  const bdata=req.body;
  console.log(bdata)
  res.sendFile(path.join(__dirname, 'public', 'blog.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
