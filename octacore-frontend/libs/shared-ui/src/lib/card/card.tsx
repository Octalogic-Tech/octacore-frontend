
import * as React from 'react';
import { styled } from '@mui/material/styles';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Collapse from '@mui/material/Collapse';
import IconButton, { IconButtonProps } from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { Chip } from '@mui/material';


interface ExpandMoreProps extends IconButtonProps {
  expand: boolean;
}

export interface CardProps {
  currentMonth: string;
}

const ExpandMore = styled((props: ExpandMoreProps) => {
  const { expand, ...other } = props;
  return <IconButton {...other} />;
})(({ theme, expand }) => ({
  transform: !expand ? 'rotate(0deg)' : 'rotate(0deg)',
  marginLeft: 'auto',
  transition: theme.transitions.create('transform', {
    duration: theme.transitions.duration.shortest,
  }),
}));

export const Cards = (props: CardProps) => {
  const { currentMonth } = props
  const [expanded, setExpanded] = React.useState(false);

  const handleExpandClick = () => {
    setExpanded(!expanded);
  };

  return (
    <Card sx={{ maxWidth: 350, background:"white"}}>
      <div style={{ margin: "2px" }}>
      <CardHeader
        avatar={<Typography>Outstanding</Typography>}
        action={<Chip color='success' label="24%" />}
      />
      <CardContent sx={{
        width:"100%",
        height: 70,
        background: "#cfd8dc"
        }}>

      </CardContent>
      <CardActions disableSpacing>
        <IconButton aria-label="add to favorites">
          <Typography>
            {currentMonth}
          </Typography>
        </IconButton>
        <ExpandMore
          expand={expanded}
          onClick={handleExpandClick}
          aria-expanded={expanded}
          aria-label="show more"
        >
          <Typography>View All</Typography>
        </ExpandMore>
      </CardActions>
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <CardContent>
          <Typography paragraph>Method:</Typography>
          <Typography paragraph>
            Heat 1/2 cup of the broth in a pot until simmering, add saffron and
            set aside for 10 minutes.
          </Typography>
        </CardContent>
      </Collapse>
      </div>
    </Card>
  );
}

