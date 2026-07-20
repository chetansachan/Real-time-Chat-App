import { MemberRole, MessageType, PrismaClient, RoomType } from '@prisma/client';
import { uuidv7 } from 'uuidv7';
import { hashPassword } from '../src/common/auth/password';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Password123!';

async function upsertUser(email: string, username: string): Promise<{ id: string }> {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { id: uuidv7(), email, username, passwordHash },
    select: { id: true },
  });
}

async function main(): Promise<void> {
  const alice = await upsertUser('alice@example.com', 'alice');
  const bob = await upsertUser('bob@example.com', 'bob');
  const cara = await upsertUser('cara@example.com', 'cara');

  let room = await prisma.room.findFirst({
    where: { type: RoomType.PUBLIC, name: 'general' },
    select: { id: true },
  });

  if (!room) {
    room = await prisma.room.create({
      data: {
        id: uuidv7(),
        type: RoomType.PUBLIC,
        name: 'general',
        ownerId: alice.id,
        members: {
          create: [
            { userId: alice.id, role: MemberRole.OWNER },
            { userId: bob.id },
            { userId: cara.id },
          ],
        },
      },
      select: { id: true },
    });
    console.log('Created room #general');
  } else {
    for (const [userId, role] of [
      [alice.id, MemberRole.OWNER],
      [bob.id, MemberRole.MEMBER],
      [cara.id, MemberRole.MEMBER],
    ] as const) {
      await prisma.roomMember.upsert({
        where: { roomId_userId: { roomId: room.id, userId } },
        update: {},
        create: { roomId: room.id, userId, role },
      });
    }
  }

  const seedMessages = [
    { senderId: alice.id, content: 'Hey! Welcome to the chat.', clientMessageId: 'seed-1' },
    { senderId: bob.id, content: 'This is the NestJS backend MVP.', clientMessageId: 'seed-2' },
    { senderId: cara.id, content: 'Try the socket smoke test next.', clientMessageId: 'seed-3' },
  ];

  for (const message of seedMessages) {
    await prisma.message.upsert({
      where: {
        senderId_clientMessageId: {
          senderId: message.senderId,
          clientMessageId: message.clientMessageId,
        },
      },
      update: {},
      create: {
        id: uuidv7(),
        roomId: room.id,
        senderId: message.senderId,
        content: message.content,
        type: MessageType.TEXT,
        clientMessageId: message.clientMessageId,
      },
    });
  }

  const last = await prisma.message.findFirst({
    where: { roomId: room.id },
    orderBy: { id: 'desc' },
    select: { createdAt: true },
  });
  if (last) {
    await prisma.room.update({
      where: { id: room.id },
      data: { lastMessageAt: last.createdAt },
    });
  }

  console.log('');
  console.log('Seed complete. Demo accounts:');
  console.log(`  alice@example.com / ${DEMO_PASSWORD}`);
  console.log(`  bob@example.com   / ${DEMO_PASSWORD}`);
  console.log(`  cara@example.com  / ${DEMO_PASSWORD}`);
  console.log(`Room #general id: ${room.id}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
