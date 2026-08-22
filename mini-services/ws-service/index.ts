import { Server } from "socket.io";

const io = new Server({
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const rooms = new Map<string, Set<string>>();

io.on("connection", (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);

  socket.on("join-group", (groupId: string) => {
    socket.join(`group:${groupId}`);
    if (!rooms.has(groupId)) rooms.set(groupId, new Set());
    rooms.get(groupId)!.add(socket.id);
    console.log(`[WS] ${socket.id} joined group ${groupId}`);
  });

  socket.on("leave-group", (groupId: string) => {
    socket.leave(`group:${groupId}`);
    rooms.get(groupId)?.delete(socket.id);
    console.log(`[WS] ${socket.id} left group ${groupId}`);
  });

  socket.on("expense-added", (data: { groupId: string; expense: any }) => {
    socket.to(`group:${data.groupId}`).emit("expense-added", data);
  });

  socket.on("expense-updated", (data: { groupId: string; expense: any }) => {
    socket.to(`group:${data.groupId}`).emit("expense-updated", data);
  });

  socket.on("expense-deleted", (data: { groupId: string; expenseId: string }) => {
    socket.to(`group:${data.groupId}`).emit("expense-deleted", data);
  });

  socket.on("settlement-added", (data: { groupId: string; settlement: any }) => {
    socket.to(`group:${data.groupId}`).emit("settlement-added", data);
  });

  socket.on("member-joined", (data: { groupId: string; user: any }) => {
    socket.to(`group:${data.groupId}`).emit("member-joined", data);
  });

  socket.on("activity", (data: { groupId: string; activity: any }) => {
    io.to(`group:${data.groupId}`).emit("activity", data);
  });

  socket.on("disconnect", () => {
    for (const [groupId, members] of rooms.entries()) {
      members.delete(socket.id);
      if (members.size === 0) rooms.delete(groupId);
    }
    console.log(`[WS] Client disconnected: ${socket.id}`);
  });
});

const PORT = 3003;
io.listen(PORT, () => {
  console.log(`[WS] SplitFlow WebSocket service running on port ${PORT}`);
});
