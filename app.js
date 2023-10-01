const express = require('express');
const mysql = require('mysql');
const session = require('express-session');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const multer = require('multer');


const app = express();
const PORT = process.env.PORT || 8000;


app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: 'your-secret-key',
  resave: true,
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
  if (!user) {
    // User is not authenticated, redirect to the login page
    res.redirect('/');
    return;
  }

  // Fetch the user's profile image from the database
  db.query('SELECT uimg FROM userprofile WHERE uid = ?', [user.id], (error, results) => {
    if (error) {
      console.error('Error fetching profile image:', error);
      return res.status(500).json({ message: 'Error fetching profile image.' });
    }

    let userImageDataUri = null;

    if (results.length > 0 && results[0].uimg !== null) {
      // Assuming results[0].uimg contains the image data (make sure it's a valid URL or base64 data)
      const userImageBuffer = results[0].uimg;
      const userImageBase64 = userImageBuffer.toString('base64');

      // Create a data URI
      userImageDataUri = `data:image/jpeg;base64,${userImageBase64}`;
    }

    // Read the HTML file
    const fs = require('fs');
    const profileHtml = fs.readFileSync(path.join(__dirname, 'public', 'profile.html'), 'utf8');

    // Replace the placeholders in the HTML file
    const updatedHtml = profileHtml
      .replace('${user.username}', user.username)
      .replace('${user.image}', userImageDataUri);

    // Send the updated HTML content as the response
    res.send(updatedHtml);
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

 
// Serve the home.html file for the /home route
app.get('/home', (req, res) => {
  // Retrieve data from the 'blog' table
  db.query('SELECT * FROM blog', (error, results) => {
    if (error) {
      console.error('Error fetching blog data', error);
      return res.status(500).json({ message: 'Error fetching blog data.' });
    }

    // Assuming 'results' contains an array of blog posts
    const blogPosts = results;

    // Read the 'home.html' file
    fs.readFile(path.join(__dirname, 'public', 'home.html'), 'utf8', (readError, fileContents) => {
      if (readError) {
        console.error('Error reading HTML file', readError);
        return res.status(500).json({ message: 'Error reading HTML file.' });
      }

      // Replace placeholders with dynamic data
      const updatedHtml = fileContents.replace('<!-- Dynamic content goes here -->', () => {
        let dynamicContent = '';

        blogPosts.forEach((post) => {
          dynamicContent += `
          <a href="/readblog/${post.author}/${post.bid}">
          <div class="blog-post" style="background-color: gainsboro">
              <h3>${post.title}</h3>
              <p>Author: ${post.author}</p>
            </div></a>
          `;
        });

        return dynamicContent;
      });

      // Send the updated HTML content as the response
      res.send(updatedHtml);
    });
  });
});


app.post('/createblog', (req, res) => {
  const bdata=req.body;
  const user = req.session.user;
  // console.log(user)
  // console.log(bdata)
  db.query('INSERT INTO blog (uid, title, content,author) VALUES (?, ?, ?,?)', [user.id,bdata.title,bdata.content,user.username], (error, results) => {
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

  // Fetch the blog post data from the database using the 'blogId'
  db.query('SELECT * FROM blog WHERE bid = ?', [blogId], (error, results) => {
    if (error) {
      console.error('Error fetching blog post data:', error);
      return res.status(500).json({ message: 'Error fetching blog post data.' });
    }

    // Check if the blog post with the specified 'blogId' exists
    if (results.length === 0) {
      return res.status(404).send('Blog post not found');
    }

    // Assuming 'results[0]' contains the blog post data
    const blogPost = results[0];

    // Fetch comments related to the blog post from the comments table
    db.query('SELECT * FROM comments WHERE bid = ?', [blogId], (commentError, commentResults) => {
      if (commentError) {
        console.error('Error fetching comments:', commentError);
        return res.status(500).json({ message: 'Error fetching comments.' });
      }

      // Assuming 'commentResults' contains an array of comments
      const comments = commentResults;

      const fs = require('fs');
      const readBlogHtml = fs.readFileSync(path.join(__dirname, 'public', 'readblog.html'), 'utf8');

      const commentedHtml = (() => {
        let dynamicContent = '';

        comments.forEach((post) => {
          dynamicContent += `
          <ul>
          <li class="blog-post" style="background-color: gainsboro">
              ${post.comments}
            </li>
          </ul>
          `;
        });

        return dynamicContent;
      })();

      
      const updatedHtml = readBlogHtml
        .replace('{blogtitle}', blogPost.title)
        .replace('{author}', blogPost.author)
        .replace('{date}', blogPost.created_at)
        .replace('{blogcontetnt}', blogPost.content)
        .replace('{{author}}', blogPost.author)
        .replace('{{blogid}}', blogPost.bid)
        .replace('{{auth}}', blogPost.author)
        .replace('{{bid}}', blogPost.bid)
        .replace('{{comments}}', commentedHtml);

      // Pass the comments data to your HTML template or handle it as needed
      // You can include the comments in your HTML, perhaps inside a loop or another HTML element.

      res.send(updatedHtml);
    });
  });
});

app.post('/readblog/:author/:blogid', (req, res) => {
  const blogId = req.params.blogid;
  const formName = req.body.formName; // Add a hidden input field with the form's name
  const user = req.session.user;
  if (formName === 'delete') {
      // Handle blog post deletion
      db.query('DELETE FROM blog WHERE bid = ?', [blogId], (error, results) => {
          if (error) {
              console.error('Error deleting blog post:', error);
              return res.status(500).json({ message: 'Error deleting blog post.' });
          }

          // Redirect to the '/home' page after deletion 
          res.redirect('/home');
      });
  } else if (formName === 'comments') {
      // Handle posting comments
      const comment = req.body.comment;
      // Insert the comment into the database, associate it with the blog post (using 'blogId')
      // Redirect back to the same blog post or handle as needed
      db.query('INSERT INTO comments (uid, bid, comments) VALUES (?, ?, ?)', [user.id,blogId,comment], (error, results) => {
        if (error) {
            console.error('Error deleting blog post:', error);
            return res.status(500).json({ message: 'Error deleting blog post.' });
        }
        res.json({ message: 'commented successfully' })
        // Redirect to the '/home' page after deletion
        
    });

  }
});


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
 