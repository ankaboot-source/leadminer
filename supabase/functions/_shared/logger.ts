export const Logger = {
  error: (message: string) => {
    const date = new Date();
    const day = date.getDate();

    const month = date.getMonth() + 1;

    const year = date.getFullYear();

    console.error(
      `[${year}-${month}-${day} ${
        new Date(date).toLocaleTimeString()
      }] %c${message}`,
      "color: red",
    );
  },
  info: (message: string) => {
    const date = new Date();
    const day = date.getDate();

    const month = date.getMonth() + 1;

    const year = date.getFullYear();

    console.log(
      `[${year}-${month}-${day} ${
        new Date(date).toLocaleTimeString()
      }] ${message}`,
    );
  },
};
