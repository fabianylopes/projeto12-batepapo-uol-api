import express, { json } from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
//import joi from 'joi';
import dotenv from 'dotenv';
import dayjs from 'dayjs';

dotenv.config();

const server = express();
server.use(json());
server.use(cors());

server.post('/participants', async (req, res) => {
    const user = req.body;

    const mongoClient = new MongoClient(process.env.MONGO_URI);
    await mongoClient.connect()

    const participantsCollection = mongoClient.db("bate-papo-uol").collection("participants");
    const messagesCollection = mongoClient.db("bate-papo-uol").collection("messages");

    const registeredParticipant = await participantsCollection.findOne({ name: user.name });
    if(registeredParticipant){
        return res.sendStatus(409);
    }

    await participantsCollection.insertOne({ ...user, lastStatus: Date.now() });

    await messagesCollection.insertOne(
        {
            from: user.name, 
            to: 'Todos', 
            text: 'entra na sala...', 
            type: 'status', 
            time: dayjs().format('HH:mm:ss')
        }
    );

    mongoClient.close();

    res.sendStatus(201);
});

server.listen(5000, () => {
    console.log('Running on http://localhost:5000');
})