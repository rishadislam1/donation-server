const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require('mongodb');



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
    if(authorization){
      return res.status(401).send({
        error: true,
        message: 'Unauthorized Access'
      })
    }
    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded)=>{
      if(error){
        res.send({error:true, message: 'Unauthorized Access'})
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

// JWT routes

app.post('/jwt', (req,res)=>{
  const user = req.body;
  const token = jwt.sign(user,process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: '1h'
  })
  res.send({token})
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


// cart collection related work

app.post('/carts', async(req,res)=>{
  const item = req.body;
  const result = cartCollection.insertOne(item);8
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
    res.send('Bistro Is Running');
})

app.listen(port, ()=>{
    console.log(`Bistro is running on port ${port}`);
})
