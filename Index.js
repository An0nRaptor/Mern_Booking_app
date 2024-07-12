import express from "express"
import Cors from "cors"
import mongoose from "mongoose"
import dotenv from "dotenv";
import User from "./Models/User.js"
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from 'path';
import { fileURLToPath } from 'url';
import multer from "multer";
import fs from "fs";
import Place from "./Models/Place.js"
import Booking from "./Models/Booking.js";
import cors from "cors"


const app = express()

app.use(Cors({
    credentials: true,
    origin: 'https://66914df39b209447776afa1f--inspiring-concha-377594.netlify.app'
}))


const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename);

app.use(express.json())
dotenv.config()
app.use('/uploads', express.static(__dirname + '/uploads'))



mongoose.connect(process.env.MONGO_URL)


const createTokenfortheUser = (user) => {

    const { email, _id, name } = user;

    const access_token = jwt.sign({ _id }, process.env.SECRET_TOKEN_KEY)

    return { access_token: access_token, email: email, id: _id, name: name }
}



const verifyJWT = (req, res, next) => {

    const authHeader = req.headers['authorization']

    const token = authHeader && authHeader.split(' ')[1]

    if (token == null) {

        return res.status(403).json({ error: "No access token" })
    }

    jwt.verify(token, process.env.SECRET_TOKEN_KEY, (err, user) => {

        if (err) {

            return res.status(403).json({ error: "Access token is invalid" })
        }


        req.id = user._id

        next()

    })

}

// Register
app.post("/register", async (req, res) => {

    try {

        const { name, email, password } = req.body;

        await bcrypt.hash(password, 8, async (err, hashedPassword) => {

            const newUser = new User({ name, email, password: hashedPassword })

            newUser.save().then((u) => {

                return res.json({ success: true, newUser: u });

            }).catch((err) => {

                console.error("Register error:", error);

                if (err) {

                    return res.status(500).json({ success: false, "error": "Email already exists!" })

                }

            })

        })


    } catch (error) {

        console.log(error.message);

    }

})


// Login
app.post("/login", async (req, res) => {

    try {

        const { email, password } = req.body;

        const user = await User.findOne({ email })

        if (user) {

            const passwordOk = bcrypt.compareSync(password, user.password)

            if (passwordOk) {


                return res.json({ success: true, user: createTokenfortheUser(user) })


            } else {

                return res.json({ success: false, "error": "Password is incorrect" })
            }

        } else {

            return res.json({ success: false, "error": "User not Found" })
        }

    } catch (error) {

        console.log(error);
    }

})


// Upload by device
const uploadPhotosMiddleware = multer({ dest: 'uploads' })

app.post('/upload', uploadPhotosMiddleware.array('photos', 100), (req, res) => {

    const uploadedFiles = []


    for (let i = 0; i < req.files.length; i++) {

        const fileInfo = req.files[i]

        let { path, originalname } = fileInfo;

        const parts = originalname.split(".")

        const extention = parts[parts.length - 1]

        const newPath = path + '.' + extention;

        fs.renameSync(path, newPath)

        uploadedFiles.push(newPath.replace('uploads', ''))

    }

    res.json(uploadedFiles)


})

// Add Place
app.post('/places', verifyJWT, async (req, res) => {


    try {

        const { title, address, addedPhotos, description, perks, extraInfo, checkIn, checkOut, maxGuests, price } = req.body


        const placeDoc = await Place.create({

            owner: req.id,
            title,
            address,
            photos: addedPhotos,
            description,
            perks: perks,
            extraInfo,
            checkIn,
            checkOut,
            maxGuests,
            price

        })


        res.json(placeDoc)

    } catch (error) {
        console.error("Failed to add place:", error);

        res.status(500).json({ error: "Failed to add place" });
    }

})

// Get places by user
app.get('/user-places', verifyJWT, async (req, res) => {


    try {
        const placesData = await Place.find({ owner: req.id })


        res.json({ placesData })

    } catch (err) {

        res.status(500).json({ error: "Failed to get places" });
    }




})

// Get place by ID
app.get('/places/:id', async (req, res) => {

    try {
        const place = await Place.findById(req.params.id);

        if (!place) {
            return res.status(404).json({ error: "Place not found" });
        }

        res.json(place);

    } catch (err) {

        res.status(500).json({ error: "Failed to get place" });
    }
});

// Edit place
app.put('/places', verifyJWT, async (req, res) => {


    try {

        const userid = req.id

        const { id, title, address, addedPhotos, description, perks, extraInfo, checkIn, checkOut, maxGuests, price } = req.body

        const placeDoc = await Place.findById(id)



        if (!placeDoc) {
            return res.status(404).json({ error: "Place not found" });
        }


        if (userid === placeDoc.owner.toString()) {

            placeDoc.set({

                title,
                address,
                photos: addedPhotos,
                description,
                perks,
                extraInfo,
                checkIn,
                checkOut,
                maxGuests,
                price

            })

            await placeDoc.save()

            res.json('OK')

        } else {

            res.status(403).json({ error: "Unauthorized" });
        }
    } catch (err) {

        console.error("Failed to update place:", err);
        res.status(500).json({ error: "Failed to update place" });
    }

})



app.get('/places', async (req, res) => {

    res.json(await Place.find())


})


// add booking
app.post('/bookings', verifyJWT, (req, res) => {

    const { place, checkIn, checkOut, numberofGuests, name, phone, price } = req.body;


    const userId = req.id

    Booking.create({

        place,
        checkIn,
        checkOut,
        numberofGuests,
        name,
        phone,
        price,
        user: userId

    }).then((doc) => {

        res.json(doc)

    }).catch((err) => {

        console.log(err);
    })


})


app.get('/bookings', verifyJWT, async (req, res) => {

    const userId = req.id

    try {

        const bookings = await Booking.find({ user: userId }).populate('place');

        res.json(bookings);

    } catch (error) {

        console.error("Failed to get bookings:", err);
        res.status(500).json({ error: "Failed to get bookings" });
    }

})








app.listen(4000, () => console.log("Server is listening"))