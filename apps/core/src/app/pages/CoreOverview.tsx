import { Grid, Typography, Box } from '@mui/material';
import {
  BreadCrumbs,
  ExpenseCards,
  SalaryCard,
} from '@octacore-frontend/shared-ui';
import { OutstandingTable } from '../components/OutstandingInvoiceTable';
import { FollowUpsTable } from '../components/FollowUpsTable';
import { styled } from '@mui/material/styles';

const TableHeadingBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginTop: '1rem',
  padding: '0px 0.3rem',
}));

const TableBox = styled(Box)(({ theme }) => ({
  overflow: 'hidden',
}));

function CoreOverview() {
  const currentDate = new Date();
  const currentMonth = currentDate.toLocaleString('default', { month: 'long' });
  const outstandingInvoiceTableData = new Array(5).fill('values');
  const followUpstableData = new Array(5).fill('values');
  const expenseCardRepeat = new Array(3).fill('values');
  const [currentProject, currentPage] = ['Projects', 'overview'];
  return (
    <>
      <BreadCrumbs currentPage={currentPage} currentProject={currentProject} />
      <Grid container spacing={1}>
        {expenseCardRepeat.map((_, index) => {
          return (
            <Grid key={index} item xs={12} sm={6} md={4} lg={3}>
              <ExpenseCards currentMonth={currentMonth} />
            </Grid>
          );
        })}
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
        <OutstandingTable outstandingInvoice={outstandingInvoiceTableData} />
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
        <FollowUpsTable followUpstableData={followUpstableData} />
      </TableBox>
    </>
  );
}

export default CoreOverview;
