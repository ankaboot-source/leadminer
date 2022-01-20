import React from 'react';

const EditUserForm = props => {

    const { handleInputChange, submitUserEdit, currentUser } = props
    const name = currentUser.name
    const email = currentUser.email

    return (
        <form onSubmit={submitUserEdit}>
            <label>Name</label>
            <input
                type="text"
                id="name"
                placeholder="Jane Doe"
                onChange={handleInputChange}
                value={name}
            />
            <label>Email</label>
            <input
                type="text"
                id="email"
                placeholder="jane.doe@gmail.com"
                onChange={handleInputChange}
                value={email}
            />
            <input type="submit" value="Edit" />
        </form>
    )
}

export default EditUserForm;