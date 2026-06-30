import { fakerZH_CN as faker } from "@faker-js/faker"
import type { User, Group, Message, Session } from "@/types"

export const currentUser: User = {
  id: "u_me",
  name: "Current User",
  avatar: faker.image.avatar(),
  status: "online",
  email: "me@example.com",
  phone: "13800138000",
  region: "Beijing, China",
  signature: "Hello World!",
}

export const generateUsers = (count: number = 50): User[] => {
  return Array.from({ length: count }).map(() => ({
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    avatar: faker.image.avatar(),
    status: faker.helpers.arrayElement(["online", "offline", "busy", "away"]) as User["status"],
    email: faker.internet.email(),
    phone: faker.phone.number(),
    region: faker.location.city(),
    signature: faker.lorem.sentence(),
  }))
}

export const generateGroups = (users: User[], count: number = 10): Group[] => {
  return Array.from({ length: count }).map(() => {
    const members = faker.helpers.arrayElements(users, { min: 3, max: 10 }).map((u) => u.id)
    return {
      id: faker.string.uuid(),
      name: faker.company.name() + " Group",
      avatar: faker.image.urlLoremFlickr({ category: "business" }),
      members: [currentUser.id, ...members],
      ownerId: faker.helpers.arrayElement(members),
      notice: faker.lorem.paragraph(),
    }
  })
}

export const generateMessages = (sessionId: string, senderIds: string[], count: number = 20): Message[] => {
  return Array.from({ length: count }).map((): Message => {
    const type = faker.helpers.arrayElement(["text", "text", "text", "image", "voice", "file", "card"]) as Message["type"]
    
    let content = faker.lorem.sentence()
    if (type === "image") content = "[图片]"
    if (type === "voice") content = "[语音]"
    if (type === "file") content = "[文件]"
    if (type === "card") content = "[名片]"

    return {
      id: faker.string.uuid(),
      sessionId,
      senderId: faker.helpers.arrayElement(senderIds),
      content,
      type,
      timestamp: faker.date.recent().getTime(),
      status: "read",
      fileUrl: type === "image" ? faker.image.urlLoremFlickr() : 
               type === "voice" ? "https://actions.google.com/sounds/v1/alarms/beep_short.ogg" : // Mock audio
               undefined,
      fileName: type === "file" ? faker.system.fileName() : undefined,
      fileSize: type === "file" ? faker.number.int({ min: 1024, max: 1024 * 1024 * 10 }) : undefined,
      voiceDuration: type === "voice" ? faker.number.int({ min: 2, max: 60 }) : undefined,
      cardInfo: type === "card" ? {
        userId: faker.string.uuid(),
        name: faker.person.fullName(),
        avatar: faker.image.avatar(),
        signature: faker.person.jobTitle()
      } : undefined
    }
  }).sort((a, b) => a.timestamp - b.timestamp)
}

export const generateSessions = (users: User[], groups: Group[]): Session[] => {
  const sessions: Session[] = []
  
  // Single chats
  users.slice(0, 10).forEach((user) => {
    sessions.push({
      id: user.id,
      type: "single",
      targetId: user.id,
      name: user.name,
      avatar: user.avatar,
      unreadCount: faker.number.int({ min: 0, max: 5 }),
      isPinned: faker.datatype.boolean({ probability: 0.1 }),
      isMuted: faker.datatype.boolean({ probability: 0.1 }),
      updatedAt: faker.date.recent().getTime(),
      lastMessage: {
        id: faker.string.uuid(),
        sessionId: user.id,
        senderId: user.id,
        content: faker.lorem.sentence(),
        type: "text",
        timestamp: faker.date.recent().getTime(),
        status: "read",
      },
    })
  })

  // Group chats
  groups.forEach((group) => {
    sessions.push({
      id: group.id,
      type: "group",
      targetId: group.id,
      name: group.name,
      avatar: group.avatar,
      unreadCount: faker.number.int({ min: 0, max: 20 }),
      isPinned: faker.datatype.boolean({ probability: 0.2 }),
      isMuted: faker.datatype.boolean({ probability: 0.3 }),
      updatedAt: faker.date.recent().getTime(),
      lastMessage: {
        id: faker.string.uuid(),
        sessionId: group.id,
        senderId: group.members[0],
        content: faker.lorem.sentence(),
        type: "text",
        timestamp: faker.date.recent().getTime(),
        status: "read",
      },
    })
  })

  return sessions.sort((a, b) => b.updatedAt - a.updatedAt)
}

// Initial mock data
export const mockUsers = generateUsers(50)
export const mockGroups = generateGroups(mockUsers, 10)
export const mockSessions = generateSessions(mockUsers, mockGroups)
