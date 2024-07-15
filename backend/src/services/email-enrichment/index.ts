import ENV from '../../config';
import logger from '../../utils/logger';
import EmailEnricherFactory from './EmailEnricherFactory';

const emailEnrichementService = new EmailEnricherFactory(ENV, logger);
export default emailEnrichementService;
