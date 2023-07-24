import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { overViewFigma } from '@octacore-frontend/constant';

/* eslint-disable-next-line */
export interface BreadCrumbsProps {
  currentPage: string;
  currentProject: string;
}

const BreadCrumBox = styled(Box)(({ theme }) => ({
  textAlign: 'start',
  padding: '0 0.3rem',
}));

export function BreadCrumbs(props: BreadCrumbsProps) {
  const { currentPage, currentProject } = props;
  return (
    <BreadCrumBox>
      <Typography component="span">
        {currentProject}/
        <Typography component="span" color="secondary.main">
          {currentPage}
        </Typography>
      </Typography>
      <Typography
        color={overViewFigma.breadCrumbsHeaderFontColor}
        variant="h4"
        gutterBottom
      >
        Overview
      </Typography>
    </BreadCrumBox>
  );
}

export default BreadCrumbs;
