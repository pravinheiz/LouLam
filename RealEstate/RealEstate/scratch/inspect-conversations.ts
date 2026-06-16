import { ChatService } from '../src/services/chat.service';

async function main() {
  const userId = '5b66e746-bcc1-43b8-99c1-8826acfa7e93'; // John Doe's ID from inspect-messages
  const conversations = await ChatService.getConversations(userId);
  console.log('Conversations for user:', userId);
  console.dir(conversations, { depth: null });
}

main().catch(console.error);
