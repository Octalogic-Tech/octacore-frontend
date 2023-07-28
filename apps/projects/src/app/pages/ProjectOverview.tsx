import { Grid, Typography, Box } from '@mui/material';
import {
  BreadCrumbs,
  ExpenseCards,
  SalaryCard,
} from '@octacore-frontend/shared-ui';
import { SupportProjectTable } from '../components/SupportProjectTable';
import { OngoingDevelopmentTable } from '../components/OngoingDevelopmentTable';
import { styled } from '@mui/material/styles';
import { TableHeadingBox } from '@octacore-frontend/constant';

const TableBox = styled(Box)(({ theme }) => ({
  overflow: 'scroll',
}));

function ProjectOverview() {
  const currentDate = new Date();
  const currentMonth = currentDate.toLocaleString('default', { month: 'long' });
  const ongoingDevelopmentTableData = new Array(5).fill('values');
  const supportTableData = new Array(5).fill('values');
  const [currentProject, currentPage] = ['Projects', 'Overview'];

  return (
    <>
      <BreadCrumbs currentPage={currentPage} currentProject={currentProject} />
      <Grid container spacing={1}>
        <Grid item xs={12} sm={6} md={4} lg={3}>
          <ExpenseCards currentMonth={currentMonth} />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={3}>
          <SalaryCard currentMonth={currentMonth} />
        </Grid>
      </Grid>
      <TableHeadingBox>
        <Typography variant="h5">OUTSTANDING INVOICES</Typography>
        <Typography
          variant="body1"
          color="secondary.main"
          style={{ cursor: 'pointer' }}
        >
          View All
        </Typography>
      </TableHeadingBox>
      <TableBox>
        <OngoingDevelopmentTable
          ongoingDevelopmentTableData={ongoingDevelopmentTableData}
        />
      </TableBox>
      <TableHeadingBox>
        <Typography variant="h5">FOLLOW UPS</Typography>
        <Typography
          variant="body1"
          color="secondary.main"
          style={{ cursor: 'pointer' }}
        >
          View All
        </Typography>
      </TableHeadingBox>
      <TableBox>
        <SupportProjectTable supportTableData={supportTableData} />
      </TableBox>
    </>
  );
}

export default ProjectOverview;
