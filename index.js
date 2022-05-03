import express, { json } from 'express';
import chalk from 'chalk';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import joi from 'joi';
import dayjs from 'dayjs';

dotenv.config();
const database = process.env.MONGO_URI;

const app = express();
app.use(json());
app.use(cors());

const participantSchema = joi.object({
    name: joi.string().required()
});

const messageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid('message', 'private_message')
})

app.post('/participants', async (req, res) => {
    const participant = req.body;

    const validation = participantSchema.validate(participant);
    if(validation.error){
        return res.sendStatus(422)
    }

    try{
        const mongoClient = new MongoClient(database);
        await mongoClient.connect();

        const participantsCollection = mongoClient.db('chat-uol').collection('participants');
        const messagesCollection = mongoClient.db('chat-uol').collection('messages');

        const registeredParticipant = await participantsCollection.findOne({ name: participant.name });
        if(registeredParticipant){
            return res.sendStatus(409)
        }

        await participantsCollection.insertOne({ ...participant, lastStatus: Date.now()});

        await messagesCollection.insertOne(
            {
                from: participant.name, 
                to: 'Todos', 
                text: 'entra na sala...', 
                type: 'status', 
                time: dayjs().format('HH:mm:ss')
            }
        );

        mongoClient.close();
        res.sendStatus(201)

    } catch(error) {
        console.log(error);
        res.sendStatus(500);
    }

});

app.get('/participants', async (req, res) => {

    try{        
        const mongoClient = new MongoClient(database);
        await mongoClient.connect();

        const participantsCollection = mongoClient.db('chat-uol').collection('participants');
        const participants = await participantsCollection.find({}).toArray();
        
        mongoClient.close();
        res.send(participants);


    }catch(error) {
        console.log(error);
        res.sendStatus(500);
    }

});

app.post('/messages', async (req, res) => {
    const message = req.body;
    const from = req.headers.user;
  
    const validation = messageSchema.validate(message);
    if (validation.error) {
      return res.sendStatus(422);
    }
  
    try {
        const mongoClient = new MongoClient(database);
        await mongoClient.connect();

        const participantsCollection = mongoClient.db('chat-uol').collection('participants');
        const messagesCollection = mongoClient.db('chat-uol').collection('messages');
    
        const registeredParticipant = await participantsCollection.findOne({ name: from })
        if (!registeredParticipant) {
            return res.sendStatus(422);
        }
    
        await messagesCollection.insertOne({
            ...message,
            from,
            time: dayjs().format("HH:mm:ss")
        });
    
        await mongoClient.close();
        res.sendStatus(201);
        } catch (error) {
        console.log(error);
        res.sendStatus(500);
        }
  });

app.get('/messages', async (req, res) => {
    const limit = parseInt(req.query.limit);
    const participant = req.headers.user;

    try {
        const mongoClient = new MongoClient(database);
        await mongoClient.connect();

        const messagesCollection = mongoClient.db('chat-uol').collection('messages');

        const messages = await messagesCollection.find({}).toArray();

        const filteredMessages = messages.filter(m => {
            return m.to === participant || m.from === participant || m.to === 'Todos' || m.type === 'message'
        })

        await mongoClient.close();

        if(limit){
            return res.send(filteredMessages.slice(-limit));
        }

        res.send(filteredMessages);
        
    } catch (error) {
        console.log(error);
        res.sendStatus(500);
    }

});

app.post('/status', async (req, res) => {
    const participant = req.headers.user;
  
    try {
        const mongoClient = new MongoClient(database);
        await mongoClient.connect();

        const participantsCollection = mongoClient.db('chat-uol').collection('participants');
    
        const registeredParticipant = await participantsCollection.findOne({ name: participant });
            if(!registeredParticipant){
                return res.sendStatus(404)
            }
        
        await participantsCollection.updateOne({
            _id: registeredParticipant._id
        }, {
            $set: { lastStatus: Date.now() }
        });

  
      await mongoClient.close();
      res.sendStatus(200);

    } catch (error) {
      console.log(error);
      res.sendStatus(500);
    }

});

setInterval(async () => {
    try {
      const lastTenSeconds = Date.now() - 10000;
  
      const mongoClient = new MongoClient(database);
      await mongoClient.connect()
  
      const participantsCollection = mongoClient.db("chat-uol").collection("participants");
      const messagesCollection = mongoClient.db("chat-uol").collection("messages");
  
      const participants = await participantsCollection.find({}).toArray();
  
      const inactiveUsers = participants.filter(p => p.lastStatus <= lastTenSeconds)
      if (inactiveUsers.length === 0) {
        await mongoClient.close();
        return;
      }
  
      const outMessages = inactiveUsers.map(p => {
        return {
          from: p.name,
          to: 'Todos',
          text: 'sai da sala...',
          type: 'status',
          time: dayjs().format("HH:mm:ss")
        }
      })
  
      await messagesCollection.insertMany(outMessages);
  
      await mongoClient.close();

    } catch (error) {
      console.log(error);
    }
  }, 15000)

app.listen(5000, () => {
    console.log(chalk.blue.bold('Running on http://localhost:5000'));
});
