import ENV from '../../config';
import logger from '../../utils/logger';
import EmailEnricherFactory from './EmailEnricherFactory';

const emailEnrichmentService = new EmailEnricherFactory(ENV, logger);
export default emailEnrichmentService;
