const express = require('express');
const mysql = require('mysql');
const session = require('express-session');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cors = require('cors');
const cookie=require('cookie-parser');





const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors({
  origin:["http://localhost:3000"],
  methods: ["POST","GET","DELETE"],
  credentials:true
}));
app.use(cookie())
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 360000000 }
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
app.get('/createblog', (req, res) => {
  const user = req.session.user;

  if (!user) {
    // Handle the case where the user is not authenticated
    res.redirect('/');
    return;
  }

  // Render the blog creation form
  res.sendFile(path.join(__dirname, 'public', 'blog.html'));
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
  const name=user.username
  if (!req.session || !req.session.user) {

    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  if (!user) {

    res.redirect('/');
    return;
  }


  db.query('SELECT uimg FROM userprofile WHERE uid = ?', [user.id], (error, results) => {
    if (error) {
      console.error('Error fetching profile image:', error);
      return res.status(500).json({ message: 'Error fetching profile image.' });
    }

    let userImageDataUri = null;

    if (results.length > 0 && results[0].uimg !== null) {

      const userImageBuffer = results[0].uimg;
      const userImageBase64 = userImageBuffer.toString('base64');


      userImageDataUri = `data:image/jpeg;base64,${userImageBase64}`;
    }
     res.send({name,userImageDataUri})

  });
});


app.post('/userprofile',upload.single('image'),(req, res) => {
  const user = req.session.user;
  const image = req.file;
  // console.log(image)
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

 

app.get('/home', (req, res) => {
  
  db.query('SELECT * FROM blog', (error, results) => {
    if (error) {
      console.error('Error fetching blog data', error);
      return res.status(500).json({ message: 'Error fetching blog data.' });
    }

    
    const blogPosts = results;
    res.send(blogPosts)
    
  });
});


app.post('/createblog',upload.single('image'),(req, res) => {
  const bdata=req.body;
  const image=req.file;
  const user = req.session.user;
  // console.log(user)
  // console.log(bdata)
  if (!image) {
    return res.status(400).json({ message: 'Image data is missing.' });
  }
  const fs = require('fs');
  const imageData = fs.readFileSync(image.path);
  db.query('INSERT INTO blog (uid,bimg, title, content,author) VALUES (?, ?, ?,?,?)', [user.id,imageData,bdata.title,bdata.content,user.username], (error, results) => {
    if (error) {
      console.error('Error creating your blog', error);
      return res.status(500).json({ message: 'Error creating blog.' });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Successfully updated the profile image
    res.status(200).json({ message: 'Blog created successfully.' });
  });
});


app.get('/readblog/:author/:blogid', (req, res) => {
  const blogId = req.params.blogid;
  
  
  db.query('SELECT * FROM blog WHERE bid = ?', [blogId], (error, results) => {
    if (error) {
      console.error('Error fetching blog post data:', error);
      return res.status(500).json({ message: 'Error fetching blog post data.' });
    }

  
    if (results.length === 0) {
      return res.status(404).send('Blog post not found');
    }

    
    const blogPost = results[0];

    let userImageDataUri = null;

    if (results.length > 0 && results[0].bimg !== null) {

      const userImageBuffer = results[0].bimg;
      const userImageBase64 = userImageBuffer.toString('base64');


      userImageDataUri = `data:image/jpeg;base64,${userImageBase64}`;
    }

    
    db.query('SELECT * FROM comments WHERE bid = ?', [blogId], (commentError, commentResults) => {
      if (commentError) {
        console.error('Error fetching comments:', commentError);
        return res.status(500).json({ message: 'Error fetching comments.' });
      }

      
      const comments = commentResults;
      res.send(comments)
      
    });
  });
});


app.post('/readblog/:author/:blogid', (req, res) => {
  const blogId = req.params.blogid;
  const user = req.session.user;

      const comment = req.body.comment;
      db.query('INSERT INTO comments (uid, bid,commenter, comments) VALUES (?, ?, ?,?)', [user.id,blogId,user.username,comment], (error, results) => {
        if (error) {
            console.error('Error deleting blog post:', error);
            return res.status(500).json({ message: 'Error deleting blog post.' });
        }
        res.json({ message: 'commented successfully' })
        
    });
});
app.delete('/readblog/:author/:blogid', (req, res) => {
  const blogId = req.params.blogid;
  db.query('DELETE FROM blog WHERE bid = ?', [blogId], (error, results) => {
    if (error) {
        console.error('Error deleting blog post:', error);
        return res.status(500).json({ message: 'Error deleting blog post.' });
    }
    res.json({ message: 'Deleted the blog' })
}); 
});

app.get('/logout', (req, res) => {
  
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
    } else {
      
      res.json({ message: 'User Logged out' })
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
 