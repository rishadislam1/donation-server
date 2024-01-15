const express = require('express');
const app = express();
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000;
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');




// middleware
app.use(cors());
app.use(express.json());

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

const menuCollection = client.db("bistroDb").collection("menu");
const cartCollection = client.db("bistroDb").collection("carts");
const userCollection = client.db('bistroDb').collection('users');


// verify admin

const verifyAdmin = async(req,res)=>{
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

app.get('/user/admin/:email', verifyJWT, async(req,res)=>{
  const email = req.params.email;

  if(req.decoded.email !== email){
    res.send({admin: false})
  }

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
  const existingUser = await userCollection.findOne(query);
  const token = jwt.sign({email,name}, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: '10h',
  });
  if(existingUser){
    return res.send({accessToken:token,message: 'EMAIL ALREADY EXISTS'})
  }
  const result = userCollection.insertOne({
    email,
    name,
    password: hashedPassword || null,
    role: "user"
  });

  res.send({ accessToken: token, message: 'Registration successful', result });

})

app.post('/login', async (req,res)=>{
  const {email,password} = req.body;
  const user = await userCollection.findOne({email});
  if(!user){
    return res.send({message: "Invalid Email"});
  }
  const passwordMatch = await bcrypt.compare(password,user.password);
  if(!passwordMatch){
    return res.send({message: "Invalid Password"});
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

app.patch('/updateuser/:id', async(req,res)=>{
  const id = req.params.id;
  const filter = {_id: new ObjectId(id)};
  const updateDoc = {
    $set: {
      role: 'admin'
    }
  }
  const result = await userCollection.updateOne(filter,updateDoc);
  res.send(result);
})


app.delete('/deleteuser/:id', async (req,res)=>{
  const id = req.params.id;
  const query = {_id: new ObjectId(id)};
  const result = await userCollection.deleteOne(query);
})


// menu code start
// menu get
app.get('/menu', async(req,res)=>{
    const result = await menuCollection.find().toArray();
    res.send(result);
})

app.get('/menusix', async(req,res)=>{
  
 
  const randomItems = await menuCollection.aggregate([{$sample:{size:6}}]).toArray();

    res.send(randomItems);

})
app.get('/menucard', async (req,res)=>{
  const menucard = await menuCollection.aggregate([{$sample:{size:3}}]).toArray();
  res.send(menucard);
})

app.post('/menu', async(req,res)=>{
  const data = req.body;

  const result = menuCollection.insertOne(data);
  res.send(result);
})


// cart collection related work

app.get('/carts', verifyJWT, async(req,res)=>{
  const email = req.query.email;
  if(!email){
    res.send([]);
  }
  const decodedEmail = req?.decoded?.email;
 
  if(email!== decodedEmail){
    res.status(403).send({error:true, message: "Forbidden Access"})
  }
  else{
    const query = {email: email};
    const result = await cartCollection.find(query).toArray();
    res.send(result);
  }
})

// app.get('/carts', async(req,res)=>{
//   const email = req.query.email;
//   if(!email){
//     res.send([]);
//   }


//     const query = {email: email};
//     const result = await cartCollection.find(query).toArray();
//     res.send(result);
  
// })

// alternative end
app.post('/carts', async(req,res)=>{
  const item = req.body;

  const result = cartCollection.insertOne(item);
  res.send(result);
})

app.delete('/carts/:id', async(req,res)=>{
  const id = req.params.id;
  const query = {_id: new ObjectId(id)};
  const result = await cartCollection.deleteOne(query);
})

// payment related api

app.post('/create-payment-intent', async(req,res)=>{
  const {price} = req.body;
  const amount = price*100;
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount,
    currency: "usd",
    payment_method_types: ['card']
  });
  res.send({
    clientSecret: paymentIntent.client_secret
  })
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
    res.send('Bistro Is Running');
})

app.listen(port, ()=>{
    console.log(`Bistro is running on port ${port}`);
})
