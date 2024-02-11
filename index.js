const express = require('express');
const app = express();
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const nodemailer = require("nodemailer");
const port = process.env.PORT || 5000;
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');




// middleware
app.use(cors());
app.use(express.json());

// mailer function


const transporter = nodemailer.createTransport({
  service: "gmail",
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: true,
  auth: {
    
    user: process.env.SMTP_MAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

app.post('/sendEmail', async (req,res)=>{
  const {email, subject, message} = req.body;
  var mailOptions = {
    from:{
      name: "Donation",
      address: process.env.SMTP_MAIL
    },
    to:email,
    subject:subject,
    text:message,
  };

  await transporter.sendMail(mailOptions, function(error,info){
    if(error){
      console.log(error);
      res.send({message:'error'})
    }
    else{
      res.send({message: "success"})
    }
  })
}
)

// mailer end mongo start
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.izzbewl.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  });
  // verify jwt

  const verifyJWT = (req, res, next)=>{
    const authorization = req.headers.authorization;
    if(!authorization){
      return res.status(401).send({
        error: true,
        message: 'Error Unauthorized Access'
      })
    }
    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded)=>{
      if(error){
        res.status(402).send({error:true, message: 'Unauthorized Access'})
      }
      req.decoded = decoded;
      next();
    })
  }

  async function run() {
    try {
      // Connect the client to the server	(optional starting in v4.7)
      await client.connect();
// write my own db code here

      const database = client.db('donation');
      const userCollection = database.collection('user');
      const addCategoryCollection = database.collection('addCategory');
      const categoryDetailsCollection = database.collection('categoryDetails');
      const donationCollection = database.collection('donationAmounts')


// verify admin

const verifyAdmin = async(req,res,next)=>{
  const email = req.decoded.email;
  const query = {email: email}
  const user = await userCollection.findOne(query);
  if(user?.role !== 'admin'){
    return res.status(403).send({error: true, message: "Forbidden Message"});
  }
  next();
}

// user related api
// security
// 1. use jwt token
app.get('/users', async (req,res)=>{
  const result = await userCollection.find().toArray();
  res.send(result);
})


// security layer
// emial same
// admin check

app.get('/user/admin/:email', async(req,res)=>{
  const email = req.params.email;

  // if(req.decoded.email !== email){
  //   res.send({admin: false})
  // }

  const query = {email: email};

  const user = await userCollection.findOne(query);
  const result = {admin: user?.role === 'admin'}
  res.send(result);
})

app.post('/register', async(req,res)=>{
  const { email, name, password } = req.body;
  let hashedPassword;
  if(password){
    const saltRounds = 10;
    hashedPassword = await bcrypt.hash(password, saltRounds);
  }
  const query = {email: email}
  const result = await userCollection.findOne(query);
  const token = jwt.sign({email,name}, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: '10h',
  });
  if(result || email === null){
    return res.send({result, accessToken:token,message: 'EMAIL ALREADY EXISTS'})
  }
  else{
    const result = userCollection.insertOne({
      email,
      name,
      password: hashedPassword || null,
      role: "user"
    });
  
    res.send({ accessToken: token, message: 'Registration successful', result });
  }

})

app.post('/login', async (req,res)=>{
  const {email,password} = req.body;
  const user = await userCollection.findOne({email});
  if(!user){
    return res.send({status: false, message: "Invalid Email"});
  }
  const passwordMatch = await bcrypt.compare(password,user.password);
  if(!passwordMatch){
    return res.send({status: false, message: "Invalid Password"});
  }

  const token  = jwt.sign({email: user.email, name: user.name}, process.env.ACCESS_TOKEN_SECRET,{
    expiresIn: "10h"
  });
  newUser={
    _id: user._id,
    email: user.email,
    name: user.name,
    role: user.role
  }


  res.send({ accessToken: token, message: 'Login successful', newUser });
})

// category apis

// add Category

app.post('/addcategory/:email', verifyJWT, verifyAdmin, async(req,res)=>{
  const data = req.body;
  const result = addCategoryCollection.insertOne(data);
  res.send({status: true, result});
})

// get category

app.get('/getcategory', async(req,res)=>{
  const result = await addCategoryCollection.find().toArray();
  res.send({status: true, result});
})

// delete category

app.delete('/deleteCategory/:email/:id', verifyJWT, verifyAdmin, async(req,res)=>{
  const id = req.params.id;
  const query = {_id: new ObjectId(id)};
  const result = await addCategoryCollection.deleteOne(query);
  res.send(result);
});

// add category details
app.post('/categoryDetails/:email',verifyJWT,verifyAdmin, async(req,res)=>{
  const data = req.body;
  const result = categoryDetailsCollection.insertOne(data);
  res.send({status:true, result})
})

// get category details

app.get('/getcategorydetails', async(req,res)=>{
  const result = await categoryDetailsCollection.find().toArray();
  res.send({status: true, result});
})

// get one category details

app.get('/getonecategory/:id', async(req,res)=>{
  const id=req.params.id;
  const query = {_id: new ObjectId(id)};
  const result = await categoryDetailsCollection.findOne(query);
  res.send(result);
})


// deletecategorydetails

app.delete('/deletecategorydetails/:email/:id', verifyJWT, verifyAdmin, async(req,res)=>{
  const id = req.params.id;
  const query = {_id: new ObjectId(id)};
  const result = await categoryDetailsCollection.deleteOne(query);
  res.send(result);
});

// donation amounts data

app.post('/paydonation', verifyJWT, async(req,res)=>{
  const bodyData = req.body;
  const status = 'pending'
  const data = {
    ...bodyData,status
  }
  const result = await donationCollection.insertOne(data);
  res.send(result);
})

// get donation

app.get('/getdonation/:userEmail', verifyJWT, async(req,res)=>{
  const {userEmail} = req.params;
 
  const query = {userEmail: userEmail}
  console.log(query)
  const result = await donationCollection.find().toArray(query);
  res.send(result);
})

      // Send a ping to confirm a successful connection
      await client.db("admin").command({ ping: 1 });
      console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
      // Ensures that the client will close when you finish/error
    //   await client.close();
    }
  }
  run().catch(console.dir);

app.get('/',(req,res)=>{
    res.send('Donation Is Running');
})

app.listen(port, ()=>{
    console.log(`Donation is running on port ${port}`);
})
