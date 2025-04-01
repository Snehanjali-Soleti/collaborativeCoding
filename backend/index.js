import express from 'express';
import http from 'http';
import {Server} from 'socket.io';
import path from 'path';
import axios from 'axios';


const app = express();

const server = http.createServer(app);

const io = new Server(server, { // cors=> giving permission to all the domains to access the server 
    cors: {
        origin: '*',
    }
});

const rooms= new Map();

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    let currentRoom = null;
    let currentUser = null;

    socket.on("join", ({roomId, username}) => {
        if(currentRoom){
            socket.leave(currentRoom);
            rooms.get(currentRoom).users.delete(currentUser);
            io.to(currentRoom).emit("userJoined",Array.from(rooms.get(currentRoom).users));
        }
        currentRoom = roomId;
        currentUser = username;

        socket.join(roomId);

        if(!rooms.has(roomId)){ // checking if the room is already created or not
            rooms.set(roomId, {users: new Set(), code: "//start code here"});
        }

        rooms.get(roomId).users.add(username);
        socket.emit("codeUpdate", rooms.get(roomId).code); // sending the code to the user who joined the room
        
        io.to(roomId).emit("userJoined",Array.from(rooms.get(currentRoom).users)); // sending the users in the room to all the users in the room
    });

    socket.on("codeChange", ({roomId, code}) => {
        if(rooms.has(roomId)){
            rooms.get(roomId).code = code; // updating the code in the room
        }
        socket.to(roomId).emit("codeUpdate", code);
    });

    socket.on("leaveRoom", () => {
        if(currentRoom && currentUser){
            rooms.get(currentRoom).users.delete(currentUser);
            socket.leave(currentRoom);
            io.to(currentRoom).emit("userJoined",Array.from(rooms.get(currentRoom).users));
            currentRoom= null;
            currentUser= null;
        }
    });

    socket.on("typing", ({roomId, username}) => {
        socket.to(roomId).emit("userTyping", username);
    });

    socket.on("languageChange", ({roomId, language}) => {
        socket.to(roomId).emit("languageUpdate", language);
    });
    socket.on("compileCode", async ({ roomId, code, language, version, input }) => {
        if (!rooms.has(roomId)) return;  // Return early if room does not exist
    
        const room = rooms.get(roomId);
        if (!room) return;
    
        try {
            const response = await axios.post("https://emkc.org/api/v2/piston/execute", {
                language,
                version,
                files: [{ content: code }],
                stdin: String(input) || "",  // Ensure input is a string
            });
    
            room.output = response.data.run.output;
            io.to(roomId).emit("codeResponse", response.data);
        } catch (error) {
            const errorMessage = error.response?.data?.message || "Error executing code";
            io.to(roomId).emit("codeResponse", { run: { output: errorMessage } });
        }
    });
    
    

    socket.on("disconnect", () => {
        if(currentRoom && currentUser){
            rooms.get(currentRoom).users.delete(currentUser);
            io.to(currentRoom).emit("userJoined",Array.from(rooms.get(currentRoom).users));
        }
    });
});


const port = process.env.PORT || 5000;


const __dirname = path.resolve(); // getting the current directory name

app.use(express.static(path.join(__dirname, '/frontend/dist'))); // serving the frontend build folder

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend','dist','index.html')); // serving the index.html file
});

server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
