const getCurrentDate = () => {
  const date = new Date();
  const day = date.getDate();

  const month = date.getMonth() + 1;

  const year = date.getFullYear();

  return `[${year}-${month}-${day} ${new Date(date).toLocaleTimeString()}]`;
};

const Logger = {
  error: (message: string) => {
    console.error(
      `${getCurrentDate()} %c${message}`,
      "color: red",
    );
  },
  info: (message: string) => {
    console.log(
      `${getCurrentDate()} ${message}`,
    );
  },
};

export default Logger;
