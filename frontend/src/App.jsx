

import React, { useEffect, useState } from "react";
import "./App.css";
import io from "socket.io-client";
import Editor from "@monaco-editor/react";
import { v4 as uuid } from "uuid";

const socket = io("http://localhost:5000");



function App() {
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [username, setUsername] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("//start code here");
  const [copySuccess, setCopySuccess] = useState(false);
  const [users, setUsers] = useState([]);
  const [typing, setTyping] = useState("");
  const [output, setOutput] = useState("");
  const [version, setVersion] = useState("*");
  const [userInput, setUserInput] = useState("");

  useEffect(() => {
    socket.on("codeUpdate", (newCode) => setCode(newCode));
    socket.on("userJoined", (users) => setUsers(users));
    socket.on("userTyping", (user) => {
      setTyping(`${user.slice(0, 8)} is typing...`);
      setTimeout(() => setTyping(""), 2000);
    });
    socket.on("languageUpdate", (newLanguage) => setLanguage(newLanguage));
    socket.on("codeResponse", (response) => setOutput(response.run.output));

    return () => {
      socket.off("codeUpdate");
      socket.off("userJoined");
      socket.off("userTyping");
      socket.off("languageUpdate");
      socket.off("codeResponse");
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => socket.emit("leaveRoom");
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      handleBeforeUnload();
    };
  }, []);

  const joinRoom = () => {
    if (roomId && username && !joined) {
      socket.emit("join", { roomId, username });
      setJoined(true);
    }
  };

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    socket.emit("codeChange", { roomId, code: newCode });
    socket.emit("typing", { roomId, username });
  };

  const handleLanguageChange = (e) => {
    const newLanguage = e.target.value;
    setLanguage(newLanguage);
    socket.emit("languageChange", { roomId, language: newLanguage });
  };

  const runCode = () => {
    socket.emit("compileCode", {
      roomId,
      code,
      language,
      version: version || "*",
      input: String(userInput),
    });
  };

  const createRoomId = () => setRoomId(uuid());

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopySuccess("Copied!");
    setTimeout(() => setCopySuccess(""), 2000);
  };

  const leaveRoom = () => {
    socket.emit("leaveRoom");
    setJoined(false);
    setRoomId("");
    setUsername("");
    setLanguage("javascript");
    setCode("//start code here");
  };

  if (!joined) {
    return (
      <div className="join-container">
        <div className="join-form">
          <h1>Join Code Room</h1>
          <input type="text" placeholder="Room Id" value={roomId} onChange={(e) => setRoomId(e.target.value)} />
          <button onClick={createRoomId} className="create-btn">Create Room</button>
          <input type="text" placeholder="Your Name" value={username} onChange={(e) => setUsername(e.target.value)} />
          <button onClick={joinRoom}>Join Room</button>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-container">
      <div className="sidebar">
        <div className="room-info">
          <h2>Code Room: {roomId}</h2>
          <button onClick={copyRoomId} className="copy-btn">Copy Id</button>
          {copySuccess && <span className="copy-success">{copySuccess}</span>}
        </div>
        <h3>Users in Room:</h3>
        <ul>
          {users.map((user, index) => <li key={index}>{user.slice(0, 8)}...</li>)}
        </ul>
        <div className="typing-indicator">{typing}</div>
        <select className="language-selector" value={language} onChange={handleLanguageChange}>
          <option value="javascript">JavaScript</option>
          <option value="java">Java</option>
          <option value="python">Python</option>
          <option value="cpp">C++</option>
        </select>
        <button className="leave-btn" onClick={leaveRoom}>Leave Room</button>
      </div>
      <div className="editor-wrapper">
        <Editor
          height="60%"
          language={language}
          value={code}
          onChange={handleCodeChange}
          theme="vs-dark"
          options={{ minimap: { enabled: false }, fontSize: 14 }}
        />
        <textarea
          className="input-console"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Enter input here..."
        />
        <button className="run-btn" onClick={runCode}>Execute</button>
        <textarea className="output-console" value={output} readOnly placeholder="Output will appear here..." />
      </div>
    </div>
  );
}

export default App;
