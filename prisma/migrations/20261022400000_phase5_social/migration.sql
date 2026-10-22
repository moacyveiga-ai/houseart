-- Phase 5 (handoff 2026-10-21): messages, community and push. Additive and reexecutable.
CREATE TABLE IF NOT EXISTS "Conversation" (
    "id" SERIAL NOT NULL,
    "artworkId" INTEGER,
    "userAId" INTEGER NOT NULL,
    "userBId" INTEGER NOT NULL,
    "lastMessageAt" TIMESTAMP(3),
    "lastPreview" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Conversation_userAId_userBId_artworkId_key" ON "Conversation"("userAId", "userBId", "artworkId");
CREATE INDEX IF NOT EXISTS "Conversation_userAId_lastMessageAt_idx" ON "Conversation"("userAId", "lastMessageAt");
CREATE INDEX IF NOT EXISTS "Conversation_userBId_lastMessageAt_idx" ON "Conversation"("userBId", "lastMessageAt");

CREATE TABLE IF NOT EXISTS "ConversationParticipant" (
    "id" SERIAL NOT NULL,
    "conversationId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "lastReadAt" TIMESTAMP(3),
    "unread" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ConversationParticipant_conversationId_userId_key" ON "ConversationParticipant"("conversationId", "userId");
CREATE INDEX IF NOT EXISTS "ConversationParticipant_userId_unread_idx" ON "ConversationParticipant"("userId", "unread");

CREATE TABLE IF NOT EXISTS "Message" (
    "id" SERIAL NOT NULL,
    "conversationId" INTEGER NOT NULL,
    "senderUserId" INTEGER,
    "kind" TEXT NOT NULL DEFAULT 'TEXT',
    "body" TEXT NOT NULL,
    "offerId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Message_conversationId_id_idx" ON "Message"("conversationId", "id");

CREATE TABLE IF NOT EXISTS "Post" (
    "id" SERIAL NOT NULL,
    "authorUserId" INTEGER NOT NULL,
    "authorMemberId" INTEGER,
    "tenantId" INTEGER,
    "kind" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT,
    "artworkId" INTEGER,
    "eventTitle" TEXT,
    "eventVenue" TEXT,
    "eventStartsOn" TEXT,
    "eventStartsAt" TEXT,
    "pollOptionsJson" TEXT,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "saveCount" INTEGER NOT NULL DEFAULT 0,
    "rsvpCount" INTEGER NOT NULL DEFAULT 0,
    "hiddenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Post_createdAt_idx" ON "Post"("createdAt");
CREATE INDEX IF NOT EXISTS "Post_authorUserId_idx" ON "Post"("authorUserId");

CREATE TABLE IF NOT EXISTS "PostComment" (
    "id" SERIAL NOT NULL,
    "targetKind" TEXT NOT NULL,
    "targetId" INTEGER NOT NULL,
    "postId" INTEGER,
    "userId" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "hiddenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PostComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PostComment_targetKind_targetId_id_idx" ON "PostComment"("targetKind", "targetId", "id");

CREATE TABLE IF NOT EXISTS "Reaction" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "targetKind" TEXT NOT NULL,
    "targetId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Reaction_userId_targetKind_targetId_kind_key" ON "Reaction"("userId", "targetKind", "targetId", "kind");
CREATE INDEX IF NOT EXISTS "Reaction_targetKind_targetId_kind_idx" ON "Reaction"("targetKind", "targetId", "kind");

CREATE TABLE IF NOT EXISTS "PollVote" (
    "id" SERIAL NOT NULL,
    "postId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "optionIdx" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PollVote_postId_userId_key" ON "PollVote"("postId", "userId");

CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx" ON "PushSubscription"("userId");

DO $fn$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConversationParticipant_conversationId_fkey') THEN
    ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Message_conversationId_fkey') THEN
    ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PostComment_postId_fkey') THEN
    ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PollVote_postId_fkey') THEN
    ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $fn$;
