import React from 'react';

const NewUserForm = props => {

    const { handleInputChange, submitNewUser, currentUser } = props
    const name = currentUser.name
    const email = currentUser.email
  
    return (
        <form onSubmit={submitNewUser}>
            <label>Name</label>
            <input
                type="text"
                id="name"
                placeholder="Jane Doe"
                onChange={(e) => handleInputChange(e)}
                value={name}
            />
            <label>Email</label>
            <input
                type="text"
                id="email"
                placeholder="jane.doe@gmail.com"
                onChange={(e) => handleInputChange(e)}
                value={email}
            />
            <input type="submit" value="Submit" />
        </form>
    )
}

export default NewUserForm;