update chat_member set last_read=(select max(id) from message where chat_id={chat_id}) 
where user_id in({ids}) and chat_id={chat_id}