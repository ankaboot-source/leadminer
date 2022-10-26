RED='\033[1;91m'
Igreen='\033[1;92m'
IBlue='\033[0;94m'
NC='\033[0m' # No Color
if [[ -z "${GG_CLIENT_ID}" ]]; then
    echo -e "${RED}You didn't setup the required env vars !${NC}"
    sleep 2
    echo -e "You should setup the required env vars in ${IBlue}'.temp.quasar.conf.js'${NC} file in the ${IBlue}'build'${NC} section."
    echo -e "Check also if you are in the development mode or production mode."
    while true; do
        read -p "Do you wish to continue without the required env vars ?" yn
        case $yn in
            [Yy]* ) break;;
            [Nn]* ) exit 1;;
            * ) echo "Please answer yes or no.";;
        esac
    done
else
  sleep 2
  echo -e "${Igreen}Required env var exists!${NC}"
  sleep 2
fi